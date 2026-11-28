import { Manutencao } from '../entities/Manutencao.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';

const colunas = `id, instrumento_id AS "instrumentoId", motivo,
  aberta_em AS "abertaEm", encerrada_em AS "encerradaEm"`;
const unidadeNaoEncontrada = () => new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');
const manutencaoNaoEncontrada = () => new ErroAplicacao(404, 'MANUTENCAO_NAO_ENCONTRADA', 'Manutenção não encontrada para este instrumento.');
const instrumentoIndisponivel = () => new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'O instrumento não está disponível para esta operação.');
const mapear = linha => new Manutencao(linha);

function mapearErro(erro) {
  if (erro.code === '23505' && erro.constraint === 'manutencoes_unidade_aberta_unica') return instrumentoIndisponivel();
  if (erro.code === '23503' && erro.constraint === 'manutencoes_instrumento_id_fkey') return unidadeNaoEncontrada();
  return erro;
}

export class ManutencaoRepository {
  constructor(banco) { this.banco = banco; }

  async listarPorInstrumento(instrumentoId) {
    const { rows: unidade } = await this.banco.query('SELECT id FROM instrumentos WHERE id = $1', [instrumentoId]);
    if (!unidade[0]) throw unidadeNaoEncontrada();
    const { rows } = await this.banco.query(
      `SELECT ${colunas} FROM manutencoes WHERE instrumento_id = $1 ORDER BY aberta_em DESC, id DESC`,
      [instrumentoId],
    );
    return rows.map(mapear);
  }

  async abrir(instrumentoId, motivo) {
    const cliente = await this.banco.connect();
    try {
      await cliente.query('BEGIN');
      const { rows: [instrumento] } = await cliente.query(
        'SELECT situacao FROM instrumentos WHERE id = $1 FOR UPDATE', [instrumentoId],
      );
      if (!instrumento) throw unidadeNaoEncontrada();
      if (instrumento.situacao !== 'DISPONIVEL') throw instrumentoIndisponivel();
      const { rowCount: emprestimosAtivos } = await cliente.query(
        'SELECT 1 FROM emprestimos WHERE instrumento_id = $1 AND devolucao_em IS NULL', [instrumentoId],
      );
      if (emprestimosAtivos) throw instrumentoIndisponivel();

      const { rows: [linha] } = await cliente.query(
        `INSERT INTO manutencoes (instrumento_id, motivo, aberta_em)
         VALUES ($1, $2, clock_timestamp()) RETURNING ${colunas}`,
        [instrumentoId, motivo],
      );
      const { rowCount } = await cliente.query(
        "UPDATE instrumentos SET situacao = 'EM_MANUTENCAO' WHERE id = $1 AND situacao = 'DISPONIVEL'",
        [instrumentoId],
      );
      if (rowCount !== 1) throw new Error('A situação do instrumento mudou dentro da transação.');
      await cliente.query('COMMIT');
      return mapear(linha);
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw mapearErro(erro);
    } finally { cliente.release(); }
  }

  async encerrar(instrumentoId, manutencaoId) {
    const cliente = await this.banco.connect();
    try {
      await cliente.query('BEGIN');
      const { rows: [instrumento] } = await cliente.query(
        'SELECT situacao FROM instrumentos WHERE id = $1 FOR UPDATE', [instrumentoId],
      );
      if (!instrumento) throw unidadeNaoEncontrada();
      const { rows: [atual] } = await cliente.query(
        `SELECT ${colunas} FROM manutencoes
         WHERE id = $1 AND instrumento_id = $2 FOR UPDATE`,
        [manutencaoId, instrumentoId],
      );
      if (!atual) throw manutencaoNaoEncontrada();
      if (atual.encerradaEm !== null) {
        await cliente.query('COMMIT');
        return mapear(atual);
      }
      if (instrumento.situacao !== 'EM_MANUTENCAO') throw instrumentoIndisponivel();
      const { rowCount: emprestimosAtivos } = await cliente.query(
        'SELECT 1 FROM emprestimos WHERE instrumento_id = $1 AND devolucao_em IS NULL', [instrumentoId],
      );
      if (emprestimosAtivos) throw instrumentoIndisponivel();

      const { rows: [encerrada] } = await cliente.query(
        `UPDATE manutencoes SET encerrada_em = GREATEST(aberta_em, clock_timestamp())
         WHERE id = $1 AND instrumento_id = $2 AND encerrada_em IS NULL RETURNING ${colunas}`,
        [manutencaoId, instrumentoId],
      );
      const { rowCount } = await cliente.query(
        "UPDATE instrumentos SET situacao = 'DISPONIVEL' WHERE id = $1 AND situacao = 'EM_MANUTENCAO'",
        [instrumentoId],
      );
      if (rowCount !== 1) throw new Error('A situação do instrumento mudou dentro da transação.');
      await cliente.query('COMMIT');
      return mapear(encerrada);
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw mapearErro(erro);
    } finally { cliente.release(); }
  }
}
