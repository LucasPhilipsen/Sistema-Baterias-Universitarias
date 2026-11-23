-- Executar somente em banco descartável bateria_confirmacoes_test_* ou bateria_integracao_test_*.
BEGIN;

DO $$
DECLARE
  v_usuario1_id integer;
  v_usuario2_id integer;
  v_ensaio_id integer;
  v_ensaio_temp_id integer;
  v_tipo1_id integer;
  v_tipo2_id integer;
  v_confirmacao_id integer;
  v_contagem integer;
BEGIN
  IF current_database() !~ '^bateria_(confirmacoes|integracao)_test_[a-z0-9_]+$'
     AND current_database() !~ '^bateria_confirmacoes_test$' THEN
    RAISE EXCEPTION 'Use um banco descartável com prefixo bateria_confirmacoes_test_ ou bateria_integracao_test_.';
  END IF;

  -- Prepara usuários de teste se não existirem
  INSERT INTO usuarios (nome, email, senha_hash, perfil)
  VALUES ('Integrante Teste SCRUM-37 1', 'integrante37_1@bateria.example', 'scrypt$131072$8$1$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'INTEGRANTE')
  ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_usuario1_id;

  INSERT INTO usuarios (nome, email, senha_hash, perfil)
  VALUES ('Integrante Teste SCRUM-37 2', 'integrante37_2@bateria.example', 'scrypt$131072$8$1$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'INTEGRANTE')
  ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_usuario2_id;

  -- Prepara ensaio de teste
  INSERT INTO ensaios (inicio_em, local, situacao)
  VALUES ('2026-11-25T19:00:00-03:00', 'Quadra Teste SCRUM-37', 'AGENDADO')
  RETURNING id INTO v_ensaio_id;

  -- Prepara tipos de instrumento
  INSERT INTO tipos_instrumentos (nome) VALUES ('Caixa Teste SCRUM-37')
  RETURNING id INTO v_tipo1_id;
  INSERT INTO tipos_instrumentos (nome) VALUES ('Surdo Teste SCRUM-37')
  RETURNING id INTO v_tipo2_id;

  -- 1. Confirmação inicial válida
  INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
  VALUES (v_ensaio_id, v_usuario1_id, v_tipo1_id)
  RETURNING id INTO v_confirmacao_id;

  IF NOT EXISTS (
    SELECT 1 FROM confirmacoes
    WHERE id = v_confirmacao_id
      AND cancelado_em IS NULL
      AND criado_em IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Falha ao gravar confirmação inicial ativa.';
  END IF;

  -- 2. Restrição de unicidade por (usuario_id, ensaio_id)
  BEGIN
    INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
    VALUES (v_ensaio_id, v_usuario1_id, v_tipo2_id);
    RAISE EXCEPTION 'Confirmação duplicada para o mesmo usuário e ensaio foi aceita.';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- 3. Chaves estrangeiras
  BEGIN
    INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
    VALUES (2147483647, v_usuario1_id, v_tipo1_id);
    RAISE EXCEPTION 'Ensaio inexistente foi aceito.';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
    VALUES (v_ensaio_id, 2147483647, v_tipo1_id);
    RAISE EXCEPTION 'Usuário inexistente foi aceito.';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
    VALUES (v_ensaio_id, v_usuario1_id, 2147483647);
    RAISE EXCEPTION 'Tipo de instrumento inexistente foi aceito.';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- 4. Exclusão de tipo de instrumento com confirmações deve ser bloqueada (ON DELETE RESTRICT)
  BEGIN
    DELETE FROM tipos_instrumentos WHERE id = v_tipo1_id;
    RAISE EXCEPTION 'Exclusão de tipo com confirmação vinculada foi aceita.';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- 5. Restrições de coerência temporal
  BEGIN
    INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id, criado_em, cancelado_em)
    VALUES (v_ensaio_id, v_usuario2_id, v_tipo1_id, '2026-11-20 12:00:00+00', '2026-11-20 11:00:00+00');
    RAISE EXCEPTION 'Cancelamento anterior à criação foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 6. Troca de tipo de instrumento
  UPDATE confirmacoes
  SET tipo_instrumento_id = v_tipo2_id, atualizado_em = CURRENT_TIMESTAMP
  WHERE id = v_confirmacao_id;

  IF NOT EXISTS (
    SELECT 1 FROM confirmacoes
    WHERE id = v_confirmacao_id AND tipo_instrumento_id = v_tipo2_id AND cancelado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Falha ao trocar o tipo de instrumento.';
  END IF;

  -- 7. Cancelamento de participação
  UPDATE confirmacoes
  SET cancelado_em = CURRENT_TIMESTAMP, atualizado_em = CURRENT_TIMESTAMP
  WHERE id = v_confirmacao_id;

  SELECT count(*) INTO v_contagem
  FROM confirmacoes
  WHERE ensaio_id = v_ensaio_id AND cancelado_em IS NULL;

  IF v_contagem <> 0 THEN
    RAISE EXCEPTION 'Participação cancelada foi considerada ativa.';
  END IF;

  -- 8. Reativação de participação
  UPDATE confirmacoes
  SET tipo_instrumento_id = v_tipo1_id, cancelado_em = NULL, atualizado_em = CURRENT_TIMESTAMP
  WHERE id = v_confirmacao_id;

  SELECT count(*) INTO v_contagem
  FROM confirmacoes
  WHERE ensaio_id = v_ensaio_id AND cancelado_em IS NULL;

  IF v_contagem <> 1 THEN
    RAISE EXCEPTION 'Falha ao reativar participação cancelada.';
  END IF;

  -- 9. Idempotência / Upsert sob concorrência (ON CONFLICT DO UPDATE)
  INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
  VALUES (v_ensaio_id, v_usuario2_id, v_tipo2_id)
  ON CONFLICT (usuario_id, ensaio_id) DO UPDATE
    SET tipo_instrumento_id = EXCLUDED.tipo_instrumento_id,
        cancelado_em = NULL,
        atualizado_em = CURRENT_TIMESTAMP;

  -- Repetir upsert mudando para tipo 1
  INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
  VALUES (v_ensaio_id, v_usuario2_id, v_tipo1_id)
  ON CONFLICT (usuario_id, ensaio_id) DO UPDATE
    SET tipo_instrumento_id = EXCLUDED.tipo_instrumento_id,
        cancelado_em = NULL,
        atualizado_em = CURRENT_TIMESTAMP;

  SELECT count(*) INTO v_contagem
  FROM confirmacoes
  WHERE ensaio_id = v_ensaio_id AND cancelado_em IS NULL;

  IF v_contagem <> 2 THEN
    RAISE EXCEPTION 'Contagem incorreta de participações ativas após upsert.';
  END IF;

  -- 10. Consulta de demanda agrupada por tipo de instrumento
  SELECT count(*) INTO v_contagem
  FROM (
    SELECT tipo_instrumento_id, count(*) AS total
    FROM confirmacoes
    WHERE ensaio_id = v_ensaio_id AND cancelado_em IS NULL
    GROUP BY tipo_instrumento_id
  ) c
  WHERE c.tipo_instrumento_id = v_tipo1_id AND c.total = 2;

  IF v_contagem <> 1 THEN
    RAISE EXCEPTION 'Cálculo de demanda ativa por tipo de instrumento falhou.';
  END IF;

  -- 11. Exclusão em cascata por ensaio
  INSERT INTO ensaios (inicio_em, local) VALUES (CURRENT_TIMESTAMP, 'Ensaio descartável')
  RETURNING id INTO v_ensaio_temp_id;
  INSERT INTO confirmacoes (ensaio_id, usuario_id, tipo_instrumento_id)
  VALUES (v_ensaio_temp_id, v_usuario1_id, v_tipo1_id);
  DELETE FROM ensaios WHERE id = v_ensaio_temp_id;
  IF EXISTS (SELECT 1 FROM confirmacoes WHERE ensaio_id = v_ensaio_temp_id) THEN
    RAISE EXCEPTION 'Cascata de exclusão por ensaio falhou.';
  END IF;

END $$;

ROLLBACK;
