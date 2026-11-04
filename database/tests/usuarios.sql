-- Executar somente em um banco de testes com a tabela e as contas fictícias.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.deve_rejeitar(comando text, estado_esperado text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE comando;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = estado_esperado THEN
      RETURN;
    END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'A operação deveria falhar com SQLSTATE %: %', estado_esperado, comando;
END;
$$;

DO $$
BEGIN
  IF (SELECT count(*) FROM usuarios WHERE email IN (
    'diretoria@bateria.example', 'integrante@bateria.example'
  )) <> 2 THEN
    RAISE EXCEPTION 'As duas contas fictícias devem estar cadastradas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'diretoria@bateria.example' AND perfil = 'DIRETORIA')
    OR NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'integrante@bateria.example' AND perfil = 'INTEGRANTE') THEN
    RAISE EXCEPTION 'Os perfis das contas fictícias estão incorretos.';
  END IF;
END;
$$;

SELECT pg_temp.deve_rejeitar(
  $$INSERT INTO usuarios (nome, email, senha_hash, perfil)
    SELECT nome, email, senha_hash, perfil FROM usuarios WHERE email = 'diretoria@bateria.example'$$,
  '23505'
);
SELECT pg_temp.deve_rejeitar(
  $$INSERT INTO usuarios (nome, email, senha_hash, perfil)
    SELECT nome, 'DIRETORIA@BATERIA.EXAMPLE', senha_hash, perfil FROM usuarios WHERE email = 'diretoria@bateria.example'$$,
  '23514'
);
SELECT pg_temp.deve_rejeitar(
  $$UPDATE usuarios SET nome = '   ' WHERE email = 'integrante@bateria.example'$$,
  '23514'
);
SELECT pg_temp.deve_rejeitar(
  $$UPDATE usuarios SET email = 'sem-arroba' WHERE email = 'integrante@bateria.example'$$,
  '23514'
);
SELECT pg_temp.deve_rejeitar(
  $$UPDATE usuarios SET perfil = 'ADMIN' WHERE email = 'integrante@bateria.example'$$,
  '23514'
);
SELECT pg_temp.deve_rejeitar(
  $$UPDATE usuarios SET senha_hash = 'senha-em-texto' WHERE email = 'integrante@bateria.example'$$,
  '23514'
);
SELECT pg_temp.deve_rejeitar(
  $$UPDATE usuarios SET email = NULL WHERE email = 'integrante@bateria.example'$$,
  '23502'
);

-- Reaplicar o seed deve preservar alterações de uma conta já existente.
UPDATE usuarios SET nome = 'Diretoria editada no teste' WHERE email = 'diretoria@bateria.example';
\ir ../seeds/001-usuarios-desenvolvimento.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM usuarios WHERE email IN (
    'diretoria@bateria.example', 'integrante@bateria.example'
  )) <> 2 THEN
    RAISE EXCEPTION 'Reaplicar o seed duplicou as contas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'diretoria@bateria.example' AND nome = 'Diretoria editada no teste') THEN
    RAISE EXCEPTION 'Reaplicar o seed sobrescreveu uma conta existente.';
  END IF;
END;
$$;

ROLLBACK;
\echo 'Restrições de usuários e reaplicação do seed verificadas.'
