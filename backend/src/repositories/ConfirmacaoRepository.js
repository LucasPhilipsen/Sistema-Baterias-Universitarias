import { Confirmacao } from '../entities/Confirmacao.js';

const SQL_UPSERT = `
  INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
  VALUES ($1, $2, $3)
  ON CONFLICT (usuario_id, ensaio_id) DO UPDATE
    SET tipo_instrumento_id = EXCLUDED.tipo_instrumento_id,
        cancelado_em = NULL,
        atualizado_em = CASE
          WHEN confirmacoes.cancelado_em IS NOT NULL
            OR confirmacoes.tipo_instrumento_id <> EXCLUDED.tipo_instrumento_id
          THEN GREATEST(confirmacoes.criado_em, confirmacoes.atualizado_em, clock_timestamp())
          ELSE confirmacoes.atualizado_em
        END
  RETURNING id, ensaio_id, usuario_id, tipo_instrumento_id, criado_em, atualizado_em, cancelado_em
`;

const SQL_CANCELAR = `
  WITH ativa AS (
    SELECT id, criado_em, atualizado_em
    FROM confirmacoes
    WHERE ensaio_id = $1 AND usuario_id = $2 AND cancelado_em IS NULL
    FOR UPDATE
  ), cancelamento AS (
    SELECT id, GREATEST(criado_em, atualizado_em, clock_timestamp()) AS instante
    FROM ativa
  )
  UPDATE confirmacoes AS c
  SET cancelado_em = cancelamento.instante, atualizado_em = cancelamento.instante
  FROM cancelamento
  WHERE c.id = cancelamento.id
  RETURNING c.id
`;

const SQL_BUSCAR_ATIVA = `
  SELECT c.id, c.ensaio_id, c.tipo_instrumento_id, t.nome AS tipo_instrumento_nome,
         c.criado_em, c.atualizado_em
  FROM confirmacoes c
  JOIN tipos_instrumentos t ON t.id = c.tipo_instrumento_id
  WHERE c.ensaio_id = $1 AND c.usuario_id = $2 AND c.cancelado_em IS NULL
`;

const SQL_BUSCAR_UPSERT_COM_NOME = `
  SELECT c.id, c.ensaio_id, c.tipo_instrumento_id, t.nome AS tipo_instrumento_nome,
         c.criado_em, c.atualizado_em
  FROM confirmacoes c
  JOIN tipos_instrumentos t ON t.id = c.tipo_instrumento_id
  WHERE c.id = $1
`;

const SQL_ENSAIO_FOR_SHARE = `
  SELECT id, situacao FROM ensaios WHERE id = $1 FOR SHARE
`;

const SQL_VERIFICAR_TIPO_INSTRUMENTO = `
  SELECT id FROM tipos_instrumentos WHERE id = $1
`;

const SQL_DEMANDA_ATIVAS = `
  SELECT tipo_instrumento_id, COUNT(*)::integer AS confirmados
  FROM confirmacoes
  WHERE ensaio_id = $1 AND cancelado_em IS NULL
  GROUP BY tipo_instrumento_id
`;

export class ConfirmacaoRepository {
  constructor(banco) {
    this.banco = banco;
  }

  #mapear(row) {
    return new Confirmacao({
      id: row.id,
      ensaioId: row.ensaio_id,
      tipoInstrumentoId: row.tipo_instrumento_id,
      tipoInstrumentoNome: row.tipo_instrumento_nome,
      confirmadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
    });
  }

  async buscarAtiva(ensaioId, usuarioId) {
    const { rows: ensaioRows } = await this.banco.query('SELECT id FROM ensaios WHERE id = $1', [ensaioId]);
    if (ensaioRows.length === 0) {
      return { status: 'ENSAIO_NAO_ENCONTRADO' };
    }
    const { rows } = await this.banco.query(SQL_BUSCAR_ATIVA, [ensaioId, usuarioId]);
    return {
      status: 'OK',
      confirmacao: rows[0] ? this.#mapear(rows[0]) : null,
    };
  }

  async confirmar(ensaioId, usuarioId, tipoInstrumentoId) {
    if (typeof this.banco.connect === 'function') {
      return this.#confirmarComTransacao(ensaioId, usuarioId, tipoInstrumentoId);
    }
    return this.#confirmarSemTransacao(ensaioId, usuarioId, tipoInstrumentoId);
  }

  async cancelar(ensaioId, usuarioId) {
    if (typeof this.banco.connect === 'function') {
      return this.#cancelarComTransacao(ensaioId, usuarioId);
    }
    return this.#cancelarSemTransacao(ensaioId, usuarioId);
  }

  async demandaAtivas(ensaioId) {
    const { rows } = await this.banco.query(SQL_DEMANDA_ATIVAS, [ensaioId]);
    return rows;
  }

  // --- Fluxo com transação (PostgreSQL real) ---

  async #confirmarComTransacao(ensaioId, usuarioId, tipoInstrumentoId) {
    const client = await this.banco.connect();
    try {
      await client.query('BEGIN');

      // Bloqueia ensaio com FOR SHARE
      const { rows: ensaioRows } = await client.query(SQL_ENSAIO_FOR_SHARE, [ensaioId]);
      if (ensaioRows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 'ENSAIO_NAO_ENCONTRADO' };
      }
      if (ensaioRows[0].situacao === 'CANCELADO') {
        await client.query('ROLLBACK');
        return { status: 'ENSAIO_CANCELADO' };
      }

      // Verifica existência do tipo de instrumento
      const { rows: tipoRows } = await client.query(SQL_VERIFICAR_TIPO_INSTRUMENTO, [tipoInstrumentoId]);
      if (tipoRows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 'TIPO_INSTRUMENTO_INVALIDO' };
      }

      // Upsert
      const { rows: upsertRows } = await client.query(SQL_UPSERT, [ensaioId, usuarioId, tipoInstrumentoId]);
      const confirmacaoId = upsertRows[0].id;

      // Busca com nome do tipo
      const { rows: resultado } = await client.query(SQL_BUSCAR_UPSERT_COM_NOME, [confirmacaoId]);

      await client.query('COMMIT');
      return { status: 'OK', confirmacao: this.#mapear(resultado[0]) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async #confirmarSemTransacao(ensaioId, usuarioId, tipoInstrumentoId) {
    // Fallback sem transação (testes unitários com banco simulado)
    const { rows: ensaioRows } = await this.banco.query(
      'SELECT id, situacao FROM ensaios WHERE id = $1', [ensaioId],
    );
    if (ensaioRows.length === 0) return { status: 'ENSAIO_NAO_ENCONTRADO' };
    if (ensaioRows[0].situacao === 'CANCELADO') return { status: 'ENSAIO_CANCELADO' };

    const { rows: tipoRows } = await this.banco.query(SQL_VERIFICAR_TIPO_INSTRUMENTO, [tipoInstrumentoId]);
    if (tipoRows.length === 0) return { status: 'TIPO_INSTRUMENTO_INVALIDO' };

    const { rows: upsertRows } = await this.banco.query(SQL_UPSERT, [ensaioId, usuarioId, tipoInstrumentoId]);
    const confirmacaoId = upsertRows[0].id;

    const { rows: resultado } = await this.banco.query(SQL_BUSCAR_UPSERT_COM_NOME, [confirmacaoId]);
    return { status: 'OK', confirmacao: this.#mapear(resultado[0]) };
  }

  async #cancelarComTransacao(ensaioId, usuarioId) {
    const client = await this.banco.connect();
    try {
      await client.query('BEGIN');

      const { rows: ensaioRows } = await client.query(SQL_ENSAIO_FOR_SHARE, [ensaioId]);
      if (ensaioRows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 'ENSAIO_NAO_ENCONTRADO' };
      }
      if (ensaioRows[0].situacao === 'CANCELADO') {
        await client.query('ROLLBACK');
        return { status: 'ENSAIO_CANCELADO' };
      }

      await client.query(SQL_CANCELAR, [ensaioId, usuarioId]);

      await client.query('COMMIT');
      return { status: 'OK' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async #cancelarSemTransacao(ensaioId, usuarioId) {
    const { rows: ensaioRows } = await this.banco.query(
      'SELECT id, situacao FROM ensaios WHERE id = $1', [ensaioId],
    );
    if (ensaioRows.length === 0) return { status: 'ENSAIO_NAO_ENCONTRADO' };
    if (ensaioRows[0].situacao === 'CANCELADO') return { status: 'ENSAIO_CANCELADO' };

    await this.banco.query(SQL_CANCELAR, [ensaioId, usuarioId]);
    return { status: 'OK' };
  }
}
