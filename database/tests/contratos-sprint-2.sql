-- Executar somente em banco descartável bateria_integracao_test_*.
BEGIN;

DO $$
DECLARE
  ensaio_id integer;
  tipo_com_unidades integer;
  tipo_sem_unidades integer;
  total integer;
  disponiveis integer;
  emprestados integer;
  em_manutencao integer;
BEGIN
  IF current_database() !~ '^bateria_integracao_test_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Use um banco descartável com prefixo bateria_integracao_test_.';
  END IF;

  INSERT INTO ensaios (inicio_em, local) VALUES ('2026-11-10T19:00:00-03:00', 'Quadra de teste')
    RETURNING id INTO ensaio_id;
  IF NOT EXISTS (
    SELECT 1 FROM ensaios WHERE id = ensaio_id
      AND inicio_em = '2026-11-10T22:00:00Z'::timestamptz
      AND situacao = 'AGENDADO' AND descricao IS NULL
  ) THEN
    RAISE EXCEPTION 'Falha no instante com fuso ou nos valores iniciais do ensaio.';
  END IF;
  BEGIN
    INSERT INTO ensaios (inicio_em, local) VALUES (CURRENT_TIMESTAMP, '   ');
    RAISE EXCEPTION 'Local vazio foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO ensaios (inicio_em, local, situacao) VALUES (CURRENT_TIMESTAMP, 'Quadra', 'INVALIDO');
    RAISE EXCEPTION 'Situação inválida de ensaio foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO tipos_instrumentos (nome) VALUES ('Tipo A teste SCRUM-34') RETURNING id INTO tipo_com_unidades;
  INSERT INTO tipos_instrumentos (nome) VALUES ('Tipo B teste SCRUM-34') RETURNING id INTO tipo_sem_unidades;
  BEGIN
    INSERT INTO tipos_instrumentos (nome) VALUES ('tipo a teste scrum-34');
    RAISE EXCEPTION 'Nome de tipo duplicado foi aceito.';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO tipos_instrumentos (nome) VALUES ('AGOGÔ TESTE SCRUM-34');
  BEGIN
    INSERT INTO tipos_instrumentos (nome) VALUES ('agogô teste scrum-34');
    RAISE EXCEPTION 'Nome de tipo duplicado com acento foi aceito.';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO instrumentos (tipo_instrumento_id, identificacao)
    VALUES (tipo_com_unidades, 'TESTE-S34-001');
  IF NOT EXISTS (SELECT 1 FROM instrumentos WHERE identificacao = 'TESTE-S34-001' AND situacao = 'DISPONIVEL') THEN
    RAISE EXCEPTION 'Nova unidade não começou disponível.';
  END IF;
  BEGIN
    INSERT INTO instrumentos (tipo_instrumento_id, identificacao) VALUES (tipo_sem_unidades, 'TESTE-S34-001');
    RAISE EXCEPTION 'Identificação duplicada entre tipos foi aceita.';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO instrumentos (tipo_instrumento_id, identificacao) VALUES (2147483647, 'TESTE-S34-FK');
    RAISE EXCEPTION 'Vínculo com tipo inexistente foi aceito.';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO instrumentos (tipo_instrumento_id, identificacao) VALUES (tipo_com_unidades, 'nao normalizado');
    RAISE EXCEPTION 'Identificação fora do padrão foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO instrumentos (tipo_instrumento_id, identificacao, situacao)
      VALUES (tipo_com_unidades, 'TESTE-S34-INVALIDO', 'INVALIDA');
    RAISE EXCEPTION 'Situação inválida de instrumento foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO instrumentos (tipo_instrumento_id, identificacao, situacao) VALUES
    (tipo_com_unidades, 'TESTE-S34-002', 'EMPRESTADO'),
    (tipo_com_unidades, 'TESTE-S34-003', 'EM_MANUTENCAO');
  SELECT count(i.id), count(i.id) FILTER (WHERE i.situacao = 'DISPONIVEL'),
      count(i.id) FILTER (WHERE i.situacao = 'EMPRESTADO'),
      count(i.id) FILTER (WHERE i.situacao = 'EM_MANUTENCAO')
    INTO total, disponiveis, emprestados, em_manutencao
    FROM tipos_instrumentos t LEFT JOIN instrumentos i ON i.tipo_instrumento_id = t.id
    WHERE t.id = tipo_com_unidades;
  IF total <> 3 OR disponiveis <> 1 OR emprestados <> 1 OR em_manutencao <> 1 THEN
    RAISE EXCEPTION 'Contagem incorreta por situação.';
  END IF;
  SELECT count(i.id) INTO total
    FROM tipos_instrumentos t LEFT JOIN instrumentos i ON i.tipo_instrumento_id = t.id
    WHERE t.id = tipo_sem_unidades;
  IF total <> 0 THEN
    RAISE EXCEPTION 'Tipo sem unidades foi contado incorretamente.';
  END IF;
END $$;

ROLLBACK;
