BEGIN;

CREATE TABLE ensaios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inicio_em timestamptz NOT NULL,
  local varchar(160) NOT NULL,
  descricao varchar(1000),
  situacao varchar(10) NOT NULL DEFAULT 'AGENDADO',

  CONSTRAINT ensaios_local_valido CHECK (local = btrim(local) AND length(local) > 0),
  CONSTRAINT ensaios_descricao_valida CHECK (
    descricao IS NULL OR (descricao = btrim(descricao) AND length(descricao) > 0)
  ),
  CONSTRAINT ensaios_situacao_valida CHECK (situacao IN ('AGENDADO', 'CANCELADO'))
);

CREATE INDEX ensaios_inicio_em_idx ON ensaios (inicio_em, id);

COMMIT;
