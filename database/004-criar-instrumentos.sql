BEGIN;

CREATE TABLE tipos_instrumentos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome varchar(80) NOT NULL,

  CONSTRAINT tipos_instrumentos_nome_valido CHECK (nome = btrim(nome) AND length(nome) > 0)
);

CREATE UNIQUE INDEX tipos_instrumentos_nome_unico
  ON tipos_instrumentos (lower(nome COLLATE "pg_unicode_fast"));

CREATE TABLE instrumentos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_instrumento_id integer NOT NULL REFERENCES tipos_instrumentos(id) ON DELETE RESTRICT,
  identificacao varchar(40) NOT NULL,
  situacao varchar(15) NOT NULL DEFAULT 'DISPONIVEL',
  observacoes varchar(500),

  CONSTRAINT instrumentos_identificacao_valida CHECK (
    identificacao ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'
  ),
  CONSTRAINT instrumentos_identificacao_unica UNIQUE (identificacao),
  CONSTRAINT instrumentos_situacao_valida CHECK (
    situacao IN ('DISPONIVEL', 'EMPRESTADO', 'EM_MANUTENCAO')
  ),
  CONSTRAINT instrumentos_observacoes_validas CHECK (
    observacoes IS NULL OR (observacoes = btrim(observacoes) AND length(observacoes) > 0)
  )
);

CREATE INDEX instrumentos_tipo_situacao_idx ON instrumentos (tipo_instrumento_id, situacao);

COMMIT;
