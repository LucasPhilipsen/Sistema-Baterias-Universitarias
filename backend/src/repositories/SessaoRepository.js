import { Usuario } from '../entities/Usuario.js';

export class SessaoRepository {
  constructor(banco) {
    this.banco = banco;
  }

  async criar({ tokenHash, usuarioId, expiraEm, tokenAnteriorHash }) {
    // A troca da sessão e a limpeza de expiradas pertencem à mesma operação atômica.
    await this.banco.query(
      `WITH removidas AS (
         DELETE FROM sessoes WHERE token_hash = $4 OR expira_em <= CURRENT_TIMESTAMP
       )
       INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, $3)`,
      [tokenHash, usuarioId, expiraEm, tokenAnteriorHash],
    );
  }

  async buscarUsuarioPorHash(tokenHash) {
    const { rows } = await this.banco.query(
      `SELECT u.id, u.nome, u.email, u.senha_hash AS "senhaHash", u.perfil
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.expira_em > CURRENT_TIMESTAMP`,
      [tokenHash],
    );
    return rows[0] ? new Usuario(rows[0]) : null;
  }

  async removerPorHash(tokenHash) {
    await this.banco.query('DELETE FROM sessoes WHERE token_hash = $1', [tokenHash]);
  }
}
