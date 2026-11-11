import { TipoInstrumento } from '../entities/TipoInstrumento.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';

const COLUNAS = 'id, nome';

export class TipoInstrumentoRepository {
  constructor(banco) {
    this.banco = banco;
  }

  async listar() {
    const { rows } = await this.banco.query(`SELECT ${COLUNAS} FROM tipos_instrumentos ORDER BY nome, id`);
    return rows.map(linha => new TipoInstrumento(linha));
  }

  async buscarPorId(id) {
    const { rows } = await this.banco.query(`SELECT ${COLUNAS} FROM tipos_instrumentos WHERE id = $1`, [id]);
    return rows[0] ? new TipoInstrumento(rows[0]) : null;
  }

  // A unicidade sem diferenciar maiúsculas, inclusive com acentos, é garantida pelo
  // índice lower(nome COLLATE "pg_unicode_fast"); consultar antes não evitaria gravações concorrentes.
  async criar(tipo) {
    const { rows } = await this.#gravar(
      `INSERT INTO tipos_instrumentos (nome) VALUES ($1) RETURNING ${COLUNAS}`,
      [tipo.nome],
    );
    return new TipoInstrumento(rows[0]);
  }

  async atualizar(id, tipo) {
    const { rows } = await this.#gravar(
      `UPDATE tipos_instrumentos SET nome = $2 WHERE id = $1 RETURNING ${COLUNAS}`,
      [id, tipo.nome],
    );
    return rows[0] ? new TipoInstrumento(rows[0]) : null;
  }

  async #gravar(sql, parametros) {
    try {
      return await this.banco.query(sql, parametros);
    } catch (erro) {
      if (erro.code === '23505' && erro.constraint === 'tipos_instrumentos_nome_unico') {
        throw new ErroAplicacao(409, 'TIPO_INSTRUMENTO_DUPLICADO', 'Já existe um tipo de instrumento com este nome.');
      }
      throw erro;
    }
  }
}
