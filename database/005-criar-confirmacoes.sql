BEGIN;

CREATE TABLE confirmacoes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ensaio_id integer NOT NULL REFERENCES ensaios(id) ON DELETE CASCADE,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_instrumento_id integer NOT NULL REFERENCES tipos_instrumentos(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  atualizado_em timestamptz,
  cancelado_em timestamptz,

  CONSTRAINT confirmacoes_usuario_ensaio_unico UNIQUE (usuario_id, ensaio_id),
  CONSTRAINT confirmacoes_atualizado_apos_criacao CHECK (atualizado_em IS NULL OR atualizado_em >= criado_em),
  CONSTRAINT confirmacoes_cancelado_apos_criacao CHECK (cancelado_em IS NULL OR cancelado_em >= criado_em)
);

CREATE INDEX confirmacoes_ensaio_idx ON confirmacoes (ensaio_id);
CREATE INDEX confirmacoes_usuario_idx ON confirmacoes (usuario_id);
CREATE INDEX confirmacoes_ativas_demanda_idx ON confirmacoes (ensaio_id, tipo_instrumento_id)
  WHERE cancelado_em IS NULL;

COMMIT;
