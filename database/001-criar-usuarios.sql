CREATE TABLE usuarios (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  senha_hash text NOT NULL,
  perfil varchar(10) NOT NULL,

  CONSTRAINT usuarios_nome_valido CHECK (nome = btrim(nome) AND length(nome) > 0),
  CONSTRAINT usuarios_email_valido CHECK (
    email = lower(btrim(email))
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  CONSTRAINT usuarios_email_unico UNIQUE (email),
  CONSTRAINT usuarios_perfil_valido CHECK (perfil IN ('DIRETORIA', 'INTEGRANTE')),
  CONSTRAINT usuarios_senha_hash_valido CHECK (
    senha_hash ~ '^scrypt[$]131072[$]8[$]1[$][0-9a-f]{32}[$][0-9a-f]{128}$'
  )
);
