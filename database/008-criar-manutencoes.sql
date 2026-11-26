BEGIN;

CREATE TABLE manutencoes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrumento_id integer NOT NULL REFERENCES instrumentos(id) ON DELETE RESTRICT,
  motivo varchar(500) NOT NULL,
  aberta_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  encerrada_em timestamptz,

  CONSTRAINT manutencoes_motivo_valido CHECK (motivo = btrim(motivo) AND motivo ~ '[^[:space:]]'),
  CONSTRAINT manutencoes_datas_validas CHECK (encerrada_em IS NULL OR encerrada_em >= aberta_em)
);

CREATE UNIQUE INDEX manutencoes_unidade_aberta_unica
  ON manutencoes (instrumento_id) WHERE encerrada_em IS NULL;

CREATE INDEX manutencoes_historico_idx
  ON manutencoes (instrumento_id, aberta_em DESC, id DESC);

COMMIT;
