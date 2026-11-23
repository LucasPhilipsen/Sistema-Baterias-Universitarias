import { Emprestimo } from '../entities/Emprestimo.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';

const COLUNAS = `e.id,
  e.usuario_id AS "usuarioId",
  u.nome AS "integranteNome",
  e.instrumento_id AS "instrumentoId",
  i.identificacao AS "instrumentoIdentificacao",
  e.retirada_em AS "retiradaEm",
  e.devolucao_em AS "devolucaoEm"`;

const emprestimoNaoEncontrado = () => new ErroAplicacao(404, 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo não encontrado.');
const instrumentoNaoEncontrado = () => new ErroAplicacao(404, 'INSTRUMENTO_NAO_ENCONTRADO', 'Instrumento não encontrado.');
const integranteNaoEncontrado = () => new ErroAplicacao(404, 'INTEGRANTE_NAO_ENCONTRADO', 'Integrante não encontrado.');
const instrumentoIndisponivel = () => new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'O instrumento não está disponível para empréstimo.');

function mapearErroIntegridade(erro) {
  if (erro.code === '23505' && erro.constraint === 'emprestimos_unidade_ativa_unica') return instrumentoIndisponivel();
  if (erro.code === '23503' && erro.constraint === 'emprestimos_usuario_id_fkey') return integranteNaoEncontrado();
  if (erro.code === '23503' && erro.constraint === 'emprestimos_instrumento_id_fkey') return instrumentoNaoEncontrado();
  return erro;
}

function mapearEmprestimo(linha) {
  return new Emprestimo({
    id: linha.id,
    integrante: { id: linha.usuarioId, nome: linha.integranteNome },
    instrumento: { id: linha.instrumentoId, identificacao: linha.instrumentoIdentificacao },
    retiradaEm: linha.retiradaEm,
    devolucaoEm: linha.devolucaoEm,
  });
}

export class EmprestimoRepository {
  constructor(banco) {
    this.banco = banco;
  }

  async listar({ usuarioId = null } = {}) {
    const { rows } = await this.banco.query(
      `SELECT ${COLUNAS}
       FROM emprestimos e
       JOIN usuarios u ON u.id = e.usuario_id
       JOIN instrumentos i ON i.id = e.instrumento_id
       WHERE ($1::integer IS NULL OR e.usuario_id = $1)
       ORDER BY e.retirada_em DESC, e.id DESC`,
      [usuarioId],
    );
    return rows.map(mapearEmprestimo);
  }

  async criar({ integranteId, instrumentoId }) {
    const cliente = await this.banco.connect();
    try {
      await cliente.query('BEGIN');
      const { rows: [instrumento] } = await cliente.query(
        'SELECT situacao FROM instrumentos WHERE id = $1 FOR UPDATE',
        [instrumentoId],
      );
      if (!instrumento) throw instrumentoNaoEncontrado();
      if (instrumento.situacao !== 'DISPONIVEL') throw instrumentoIndisponivel();

      // FOR SHARE estabiliza o perfil durante esta transação sem conflitar com a FK de usuario_id.
      const { rowCount } = await cliente.query(
        "SELECT id FROM usuarios WHERE id = $1 AND perfil = 'INTEGRANTE' FOR SHARE",
        [integranteId],
      );
      if (rowCount === 0) throw integranteNaoEncontrado();

      const { rows: [criado] } = await cliente.query(
        `INSERT INTO emprestimos (usuario_id, instrumento_id, retirada_em)
         VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id`,
        [integranteId, instrumentoId],
      );
      const { rowCount: unidadesAtualizadas } = await cliente.query(
        "UPDATE instrumentos SET situacao = 'EMPRESTADO' WHERE id = $1 AND situacao = 'DISPONIVEL'",
        [instrumentoId],
      );
      if (unidadesAtualizadas !== 1) throw new Error('A situação do instrumento mudou dentro da transação.');

      const { rows: [linha] } = await cliente.query(
        `SELECT ${COLUNAS}
         FROM emprestimos e
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN instrumentos i ON i.id = e.instrumento_id
         WHERE e.id = $1`,
        [criado.id],
      );
      await cliente.query('COMMIT');
      return mapearEmprestimo(linha);
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw mapearErroIntegridade(erro);
    } finally {
      cliente.release();
    }
  }

  async devolver(id) {
    const cliente = await this.banco.connect();
    try {
      await cliente.query('BEGIN');
      // A leitura inicial só descobre qual linha de estoque deve ser bloqueada.
      const { rows: [referencia] } = await cliente.query(
        'SELECT instrumento_id AS "instrumentoId" FROM emprestimos WHERE id = $1',
        [id],
      );
      if (!referencia) throw emprestimoNaoEncontrado();

      const { rows: [instrumento] } = await cliente.query(
        'SELECT situacao FROM instrumentos WHERE id = $1 FOR UPDATE',
        [referencia.instrumentoId],
      );
      if (!instrumento) throw instrumentoNaoEncontrado();

      // O empréstimo só é bloqueado depois da unidade, na mesma ordem de estoque/manutenção.
      const { rows: [atual] } = await cliente.query(
        `SELECT ${COLUNAS}
         FROM emprestimos e
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN instrumentos i ON i.id = e.instrumento_id
         WHERE e.id = $1
         FOR UPDATE OF e`,
        [id],
      );
      if (!atual) throw emprestimoNaoEncontrado();
      if (atual.devolucaoEm !== null) {
        await cliente.query('COMMIT');
        return mapearEmprestimo(atual);
      }
      if (instrumento.situacao !== 'EMPRESTADO') {
        throw new Error('Empréstimo ativo associado a instrumento fora da situação EMPRESTADO.');
      }

      await cliente.query(
        'UPDATE emprestimos SET devolucao_em = CURRENT_TIMESTAMP WHERE id = $1 AND devolucao_em IS NULL',
        [id],
      );
      const { rowCount: unidadesAtualizadas } = await cliente.query(
        "UPDATE instrumentos SET situacao = 'DISPONIVEL' WHERE id = $1 AND situacao = 'EMPRESTADO'",
        [referencia.instrumentoId],
      );
      if (unidadesAtualizadas !== 1) throw new Error('A situação do instrumento mudou dentro da transação.');

      const { rows: [devolvido] } = await cliente.query(
        `SELECT ${COLUNAS}
         FROM emprestimos e
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN instrumentos i ON i.id = e.instrumento_id
         WHERE e.id = $1`,
        [id],
      );
      await cliente.query('COMMIT');
      return mapearEmprestimo(devolvido);
    } catch (erro) {
      await cliente.query('ROLLBACK').catch(() => {});
      throw mapearErroIntegridade(erro);
    } finally {
      cliente.release();
    }
  }
}
