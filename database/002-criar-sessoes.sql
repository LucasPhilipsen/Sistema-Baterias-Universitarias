CREATE TABLE sessoes (
  token_hash char(64) PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  CONSTRAINT sessoes_token_hash_valido CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX sessoes_expiracao_idx ON sessoes (expira_em);
CREATE INDEX sessoes_usuario_idx ON sessoes (usuario_id);
