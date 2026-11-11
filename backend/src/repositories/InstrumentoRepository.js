import { Instrumento, SituacaoInstrumento } from '../entities/Instrumento.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';

const COLUNAS = `id, tipo_instrumento_id AS "tipoInstrumentoId", identificacao, situacao, observacoes`;

const erroTipoInvalido = () => new ErroAplicacao(400, 'TIPO_INSTRUMENTO_INVALIDO', 'O tipo de instrumento informado não existe.');

function mapearErroIntegridade(erro) {
  if (erro.code === '23505' && erro.constraint === 'instrumentos_identificacao_unica') {
    return new ErroAplicacao(409, 'IDENTIFICACAO_DUPLICADA', 'Já existe um instrumento com esta identificação.');
  }
  if (erro.code === '23503' && erro.constraint === 'instrumentos_tipo_instrumento_id_fkey') {
    return erroTipoInvalido();
  }
  return erro;
}

export class InstrumentoRepository {
  constructor(banco) {
    this.banco = banco;
  }

  async listar({ tipoInstrumentoId = null, situacao = null } = {}) {
    const { rows } = await this.banco.query(
      `SELECT ${COLUNAS} FROM instrumentos
       WHERE ($1::integer IS NULL OR tipo_instrumento_id = $1)
         AND ($2::varchar IS NULL OR situacao = $2)
       ORDER BY identificacao, id`,
      [tipoInstrumentoId, situacao],
    );
    return rows.map(linha => new Instrumento(linha));
  }

  async buscarPorId(id) {
    const { rows } = await this.banco.query(`SELECT ${COLUNAS} FROM instrumentos WHERE id = $1`, [id]);
    return rows[0] ? new Instrumento(rows[0]) : null;
  }

  // A situação inicial vem do DEFAULT do banco (DISPONIVEL); a condição sobre o tipo faz um tipo
  // inexistente retornar TIPO_INSTRUMENTO_INVALIDO antes de uma eventual duplicidade.
  async criar(instrumento) {
    try {
      const { rows } = await this.banco.query(
        `INSERT INTO instrumentos (tipo_instrumento_id, identificacao, observacoes)
         SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM tipos_instrumentos WHERE id = $1)
         RETURNING ${COLUNAS}`,
        [instrumento.tipoInstrumentoId, instrumento.identificacao, instrumento.observacoes],
      );
      if (!rows[0]) throw erroTipoInvalido();
      return new Instrumento(rows[0]);
    } catch (erro) {
      throw mapearErroIntegridade(erro);
    }
  }

  // A unidade fica bloqueada durante a transação: uma mudança de situação concorrente
  // (empréstimo ou manutenção) espera a edição terminar ou é observada antes da troca de tipo.
  async atualizar(id, instrumento) {
    const cliente = await this.banco.connect();
    try {
      await cliente.query('BEGIN');
      const { rows: [atual] } = await cliente.query(
        'SELECT tipo_instrumento_id AS "tipoInstrumentoId", situacao FROM instrumentos WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!atual) {
        await cliente.query('ROLLBACK');
        return null;
      }
      if (atual.tipoInstrumentoId !== instrumento.tipoInstrumentoId) {
        const { rowCount } = await cliente.query('SELECT 1 FROM tipos_instrumentos WHERE id = $1', [instrumento.tipoInstrumentoId]);
        if (rowCount === 0) throw erroTipoInvalido();
        if (atual.situacao !== SituacaoInstrumento.DISPONIVEL) {
          throw new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'Só é possível trocar o tipo de uma unidade disponível.');
        }
      }
      const { rows } = await cliente.query(
        `UPDATE instrumentos SET tipo_instrumento_id = $2, identificacao = $3, observacoes = $4
         WHERE id = $1 RETURNING ${COLUNAS}`,
        [id, instrumento.tipoInstrumentoId, instrumento.identificacao, instrumento.observacoes],
      );
      await cliente.query('COMMIT');
      return new Instrumento(rows[0]);
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw mapearErroIntegridade(erro);
    } finally {
      cliente.release();
    }
  }

  // COUNT(instrumentos.id) mantém tipos sem unidades com zero; ::integer devolve números JSON.
  async resumirPorTipo() {
    const { rows } = await this.banco.query(
      `SELECT t.id AS "tipoInstrumentoId", t.nome,
              COUNT(i.id)::integer AS total,
              COUNT(i.id) FILTER (WHERE i.situacao = 'DISPONIVEL')::integer AS disponiveis,
              COUNT(i.id) FILTER (WHERE i.situacao = 'EMPRESTADO')::integer AS emprestados,
              COUNT(i.id) FILTER (WHERE i.situacao = 'EM_MANUTENCAO')::integer AS "emManutencao"
       FROM tipos_instrumentos t
       LEFT JOIN instrumentos i ON i.tipo_instrumento_id = t.id
       GROUP BY t.id, t.nome
       ORDER BY t.nome, t.id`,
    );
    return rows;
  }
}
