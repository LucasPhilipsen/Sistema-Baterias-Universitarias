import { Ensaio } from '../entities/Ensaio.js';

export class EnsaioRepository {
  constructor(banco) {
    this.banco = banco;
  }

  #mapear(row) {
    return {
      id: row.id,
      inicioEm: row.inicio_em,
      local: row.local,
      descricao: row.descricao,
      situacao: row.situacao,
    };
  }

  async listar({ situacao } = {}) {
    let sql = 'SELECT id, inicio_em, local, descricao, situacao FROM ensaios';
    const params = [];
    if (situacao) {
      sql += ' WHERE situacao = $1';
      params.push(situacao);
    }
    sql += ' ORDER BY inicio_em ASC, id ASC';
    const { rows } = await this.banco.query(sql, params);
    return rows.map(r => new Ensaio(this.#mapear(r)));
  }

  async buscarPorId(id) {
    const { rows } = await this.banco.query(
      'SELECT id, inicio_em, local, descricao, situacao FROM ensaios WHERE id = $1',
      [id],
    );
    return rows[0] ? new Ensaio(this.#mapear(rows[0])) : null;
  }

  async criar({ inicioEm, local, descricao }) {
    const { rows } = await this.banco.query(
      `INSERT INTO ensaios (inicio_em, local, descricao, situacao)
       VALUES ($1, $2, $3, 'AGENDADO')
       RETURNING id, inicio_em, local, descricao, situacao`,
      [inicioEm, local, descricao],
    );
    return new Ensaio(this.#mapear(rows[0]));
  }

  async atualizar(id, { inicioEm, local, descricao }) {
    if (typeof this.banco.connect === 'function') {
      const client = await this.banco.connect();
      try {
        await client.query('BEGIN');
        const { rows: consulta } = await client.query(
          'SELECT id, situacao FROM ensaios WHERE id = $1 FOR UPDATE',
          [id],
        );
        if (consulta.length === 0) {
          await client.query('ROLLBACK');
          return { encontrado: false };
        }
        if (consulta[0].situacao === 'CANCELADO') {
          await client.query('ROLLBACK');
          return { encontrado: true, cancelado: true };
        }
        const { rows: atualizado } = await client.query(
          `UPDATE ensaios
           SET inicio_em = $1, local = $2, descricao = $3
           WHERE id = $4
           RETURNING id, inicio_em, local, descricao, situacao`,
          [inicioEm, local, descricao, id],
        );
        await client.query('COMMIT');
        return { encontrado: true, cancelado: false, ensaio: new Ensaio(this.#mapear(atualizado[0])) };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const { rows: consulta } = await this.banco.query(
        'SELECT id, situacao FROM ensaios WHERE id = $1',
        [id],
      );
      if (consulta.length === 0) {
        return { encontrado: false };
      }
      if (consulta[0].situacao === 'CANCELADO') {
        return { encontrado: true, cancelado: true };
      }
      const { rows: atualizado } = await client.query(
        `UPDATE ensaios
         SET inicio_em = $1, local = $2, descricao = $3
         WHERE id = $4 AND situacao != 'CANCELADO'
         RETURNING id, inicio_em, local, descricao, situacao`,
        [inicioEm, local, descricao, id],
      );
      if (atualizado.length === 0) {
        return { encontrado: true, cancelado: true };
      }
      return { encontrado: true, cancelado: false, ensaio: new Ensaio(this.#mapear(atualizado[0])) };
    }
  }

  async cancelar(id) {
    const { rows } = await this.banco.query(
      `UPDATE ensaios
       SET situacao = 'CANCELADO'
       WHERE id = $1
       RETURNING id, inicio_em, local, descricao, situacao`,
      [id],
    );
    return rows[0] ? new Ensaio(this.#mapear(rows[0])) : null;
  }
}
