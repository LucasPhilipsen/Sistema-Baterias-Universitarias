import { PerfilUsuario, Usuario } from '../entities/Usuario.js';
import { ErroAplicacao } from '../errors/ErroAplicacao.js';

const COLUNAS_PUBLICAS = 'id, nome, email, perfil';

export class UsuarioRepository {
  constructor(banco) {
    this.banco = banco;
  }

  async buscarPorEmail(email) {
    const { rows } = await this.banco.query(
      `SELECT id, nome, email, senha_hash AS "senhaHash", perfil
       FROM usuarios WHERE email = $1`,
      [email],
    );
    return rows[0] ? new Usuario(rows[0]) : null;
  }

  async listarIntegrantes() {
    const { rows } = await this.banco.query(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE perfil = $1 ORDER BY nome, id`,
      [PerfilUsuario.INTEGRANTE],
    );
    return rows;
  }

  async buscarIntegrantePorId(id) {
    const { rows } = await this.banco.query(
      `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = $1 AND perfil = $2`,
      [id, PerfilUsuario.INTEGRANTE],
    );
    return rows[0] ?? null;
  }

  async criarIntegrante({ nome, email, senhaHash }) {
    const { rows } = await this.#gravarIntegrante(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUNAS_PUBLICAS}`,
      [nome, email, senhaHash, PerfilUsuario.INTEGRANTE],
    );
    return rows[0];
  }

  async atualizarIntegrante(id, { nome, email }) {
    const { rows } = await this.#gravarIntegrante(
      `UPDATE usuarios SET nome = $2, email = $3 WHERE id = $1 AND perfil = $4
       RETURNING ${COLUNAS_PUBLICAS}`,
      [id, nome, email, PerfilUsuario.INTEGRANTE],
    );
    return rows[0] ?? null;
  }

  async #gravarIntegrante(sql, parametros) {
    try {
      return await this.banco.query(sql, parametros);
    } catch (erro) {
      if (erro.code === '23505' && erro.constraint === 'usuarios_email_unico') {
        throw new ErroAplicacao(409, 'EMAIL_DUPLICADO', 'Já existe uma conta com este e-mail.');
      }
      throw erro;
    }
  }
}
