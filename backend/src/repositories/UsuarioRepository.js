import { Usuario } from '../entities/Usuario.js';

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
}
