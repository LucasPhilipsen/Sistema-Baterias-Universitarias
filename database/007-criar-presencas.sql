BEGIN;

CREATE TABLE presencas (
  ensaio_id integer NOT NULL REFERENCES ensaios(id) ON DELETE RESTRICT,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  presente boolean NOT NULL,
  registrado_em timestamptz NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT presencas_ensaio_usuario_pk PRIMARY KEY (ensaio_id, usuario_id)
);

COMMIT;
