BEGIN;

CREATE TABLE emprestimos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  instrumento_id integer NOT NULL REFERENCES instrumentos(id) ON DELETE RESTRICT,
  retirada_em timestamptz NOT NULL,
  devolucao_em timestamptz,

  CONSTRAINT emprestimos_datas_validas CHECK (
    devolucao_em IS NULL OR devolucao_em >= retirada_em
  )
);

CREATE UNIQUE INDEX emprestimos_unidade_ativa_unica
  ON emprestimos (instrumento_id) WHERE devolucao_em IS NULL;

CREATE INDEX emprestimos_usuario_retirada_idx
  ON emprestimos (usuario_id, retirada_em DESC, id DESC);

COMMIT;
