import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/AuthService.js';
import { SenhaService } from '../src/services/SenhaService.js';
import { UsuarioRepository } from '../src/repositories/UsuarioRepository.js';
import { SessaoRepository } from '../src/repositories/SessaoRepository.js';
import { EnsaioRepository } from '../src/repositories/EnsaioRepository.js';
import { EnsaioService } from '../src/services/EnsaioService.js';
import { ConfirmacaoRepository } from '../src/repositories/ConfirmacaoRepository.js';
import { ConfirmacaoService } from '../src/services/ConfirmacaoService.js';
import { criarDemandaService } from '../src/config/demanda.js';
import { env } from '../src/config/env.js';

const habilitado = process.env.CONFIRMACAO_PG_INTEGRATION === '1' || process.env.PG_INTEGRATION === '1';

test('participação em ensaios com PostgreSQL descartável', { skip: !habilitado }, async t => {
  const dbSuffix = randomBytes(4).toString('hex');
  const nomeBancoDescartavel = `bateria_confirmacoes_test_${dbSuffix}`;

  const adminConfig = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password || process.env.DB_PASSWORD || '1234',
    database: 'postgres',
  };

  const adminPool = new pg.Pool(adminConfig);
  await adminPool.query(`CREATE DATABASE ${nomeBancoDescartavel}`);

  const testDbConfig = { ...adminConfig, database: nomeBancoDescartavel };
  const banco = new pg.Pool(testDbConfig);

  t.after(async () => {
    await banco.end();
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${nomeBancoDescartavel} WITH (FORCE)`);
    } finally {
      await adminPool.end();
    }
  });

  // Aplica migrações
  for (const caminho of [
    '001-criar-usuarios.sql',
    '002-criar-sessoes.sql',
    '003-criar-ensaios.sql',
    '004-criar-instrumentos.sql',
    '005-criar-confirmacoes.sql',
    'seeds/001-usuarios-desenvolvimento.sql',
  ]) {
    const sql = await readFile(new URL(`../../database/${caminho}`, import.meta.url), 'utf8');
    await banco.query(sql);
  }

  // Cria tipos de instrumento de teste
  const { rows: [tipoCaixa] } = await banco.query(
    "INSERT INTO tipos_instrumentos (nome) VALUES ('Caixa') RETURNING id",
  );
  const { rows: [tipoSurdo] } = await banco.query(
    "INSERT INTO tipos_instrumentos (nome) VALUES ('Surdo') RETURNING id",
  );

  // Instancia serviços reais
  const usuarioRepo = new UsuarioRepository(banco);
  const sessaoRepo = new SessaoRepository(banco);
  const authService = new AuthService({
    usuarios: usuarioRepo,
    sessoes: sessaoRepo,
    senhas: new SenhaService(),
  });

  const ensaioRepo = new EnsaioRepository(banco);
  const ensaioService = new EnsaioService({ ensaios: ensaioRepo });
  const confirmacaoRepo = new ConfirmacaoRepository(banco);
  const confirmacaoService = new ConfirmacaoService({ confirmacoes: confirmacaoRepo });

  const app = createApp({ authService, ensaioService, confirmacaoService, demandaService: criarDemandaService(banco) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  const login = async (email, senha) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie').split(';')[0];
  };

  const cookieDiretoria = await login('diretoria@bateria.example', 'DiretoriaDemo!2026');
  const cookieIntegrante = await login('integrante@bateria.example', 'IntegranteDemo!2026');

  // Diretoria cria um ensaio agendado
  const postEnsaio = await fetch(`${base}/api/ensaios`, {
    method: 'POST',
    headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inicioEm: '2026-11-25T19:00:00-03:00',
      local: 'Quadra de ensaio',
    }),
  });
  assert.equal(postEnsaio.status, 201);
  const { ensaio } = await postEnsaio.json();
  const ensaioId = ensaio.id;

  // --- 1. Consulta sem participação ativa retorna null ---
  await t.test('GET minha-participacao retorna null sem confirmação', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { participacao: null });
  });

  // --- 2. Confirmação de participação ---
  await t.test('PUT minha-participacao confirma participação', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.participacao.ensaioId, ensaioId);
    assert.equal(body.participacao.tipoInstrumentoId, tipoCaixa.id);
    assert.equal(body.participacao.tipoInstrumentoNome, 'Caixa');
    assert.ok(body.participacao.confirmadoEm);
    assert.ok(body.participacao.id);
  });

  // --- 3. Consulta com participação ativa ---
  await t.test('GET minha-participacao retorna confirmação ativa', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.participacao.tipoInstrumentoId, tipoCaixa.id);
    assert.equal(body.participacao.tipoInstrumentoNome, 'Caixa');
  });

  // --- 4. Troca de tipo de instrumento ---
  await t.test('PUT minha-participacao troca tipo de instrumento', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoSurdo.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.participacao.tipoInstrumentoId, tipoSurdo.id);
    assert.equal(body.participacao.tipoInstrumentoNome, 'Surdo');
    assert.ok(body.participacao.atualizadoEm); // foi atualizado
  });

  // --- 5. Cancelamento de participação ---
  await t.test('DELETE minha-participacao cancela participação', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { participacao: null });
  });

  // --- 6. Após cancelamento, GET retorna null ---
  await t.test('GET minha-participacao retorna null após cancelamento', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { participacao: null });
  });

  // --- 7. Reativação via PUT após cancelamento ---
  await t.test('PUT minha-participacao reativa participação cancelada', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.participacao.tipoInstrumentoId, tipoCaixa.id);
    assert.equal(body.participacao.tipoInstrumentoNome, 'Caixa');
  });

  // --- 8. Sessão ausente ---
  await t.test('GET minha-participacao sem sessão retorna 401', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, 'SESSAO_INVALIDA');
  });

  // --- 9. Ensaio não encontrado ---
  await t.test('GET minha-participacao em ensaio inexistente retorna 404', async () => {
    const res = await fetch(`${base}/api/ensaios/999999/minha-participacao`, {
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'ENSAIO_NAO_ENCONTRADO');
  });

  await t.test('PUT minha-participacao em ensaio inexistente retorna 404', async () => {
    const res = await fetch(`${base}/api/ensaios/999999/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'ENSAIO_NAO_ENCONTRADO');
  });

  await t.test('DELETE minha-participacao em ensaio inexistente retorna 404', async () => {
    const res = await fetch(`${base}/api/ensaios/999999/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, 'ENSAIO_NAO_ENCONTRADO');
  });

  // --- 10. Tipo de instrumento inválido ---
  await t.test('PUT minha-participacao com tipo inexistente retorna 400', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: 999999 }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'TIPO_INSTRUMENTO_INVALIDO');
  });

  // --- 11. Dados inválidos ---
  await t.test('PUT minha-participacao sem tipoInstrumentoId retorna 400', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'DADOS_INVALIDOS');
  });

  await t.test('PUT minha-participacao com campo extra retorna 400', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id, extra: true }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'DADOS_INVALIDOS');
  });

  // --- 12. ID de ensaio inválido na URL ---
  await t.test('GET minha-participacao com id inválido retorna 400', async () => {
    const res = await fetch(`${base}/api/ensaios/abc/minha-participacao`, {
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'DADOS_INVALIDOS');
  });

  // --- 13. Query params não permitidos ---
  await t.test('GET minha-participacao com query params retorna 400', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao?foo=bar`, {
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'DADOS_INVALIDOS');
  });

  // --- 14. Ensaio cancelado recusa novas confirmações ---
  await t.test('PUT minha-participacao em ensaio cancelado retorna 409', async () => {
    // Cria um segundo ensaio e cancela
    const postRes = await fetch(`${base}/api/ensaios`, {
      method: 'POST',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inicioEm: '2026-12-01T19:00:00-03:00', local: 'Local teste' }),
    });
    const { ensaio: ensaio2 } = await postRes.json();

    await fetch(`${base}/api/ensaios/${ensaio2.id}/cancelamento`, {
      method: 'PATCH',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: '{}',
    });

    const res = await fetch(`${base}/api/ensaios/${ensaio2.id}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, 'ENSAIO_CANCELADO');
  });

  // --- 15. DELETE em ensaio cancelado retorna 409 ---
  await t.test('DELETE minha-participacao em ensaio cancelado retorna 409', async () => {
    // Cria outro ensaio, confirma, depois cancela o ensaio
    const postRes = await fetch(`${base}/api/ensaios`, {
      method: 'POST',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inicioEm: '2026-12-02T19:00:00-03:00', local: 'Local teste 2' }),
    });
    const { ensaio: ensaio3 } = await postRes.json();

    // Confirma participação
    await fetch(`${base}/api/ensaios/${ensaio3.id}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });

    // Cancela o ensaio
    await fetch(`${base}/api/ensaios/${ensaio3.id}/cancelamento`, {
      method: 'PATCH',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: '{}',
    });

    const res = await fetch(`${base}/api/ensaios/${ensaio3.id}/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, 'ENSAIO_CANCELADO');
  });

  // --- 16. Demanda: confirmação ativa conta, cancelada não conta ---
  await t.test('confirmações ativas contam na demanda e canceladas não', async () => {
    // O integrante já está confirmado no ensaio 1 com tipoCaixa
    // Diretoria confirma também
    await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });

    // Consulta direta na demanda
    const demanda = await confirmacaoRepo.demandaAtivas(ensaioId);
    const caixaDemanda = demanda.find(d => d.tipo_instrumento_id === tipoCaixa.id);
    assert.ok(caixaDemanda);
    assert.equal(caixaDemanda.confirmados, 2);

    // Diretoria cancela a própria participação
    await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieDiretoria },
    });

    const demanda2 = await confirmacaoRepo.demandaAtivas(ensaioId);
    const caixaDemanda2 = demanda2.find(d => d.tipo_instrumento_id === tipoCaixa.id);
    assert.ok(caixaDemanda2);
    assert.equal(caixaDemanda2.confirmados, 1);

    const resposta = await fetch(`${base}/api/ensaios/${ensaioId}/demanda`, {
      headers: { Cookie: cookieDiretoria },
    });
    assert.equal(resposta.status, 200);
    const { demanda: consulta } = await resposta.json();
    assert.equal(consulta.tipos.find(tipo => tipo.tipoInstrumentoId === tipoCaixa.id)?.confirmados, 1);
  });

  // --- 17. Rota de cancelamento do ensaio pela diretoria continua funcionando ---
  await t.test('PATCH cancelamento do ensaio pela diretoria preservado', async () => {
    const postRes = await fetch(`${base}/api/ensaios`, {
      method: 'POST',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inicioEm: '2026-12-03T19:00:00-03:00', local: 'Local preservação' }),
    });
    const { ensaio: ensaio4 } = await postRes.json();
    const cancelRes = await fetch(`${base}/api/ensaios/${ensaio4.id}/cancelamento`, {
      method: 'PATCH',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(cancelRes.status, 200);
    const body = await cancelRes.json();
    assert.equal(body.ensaio.situacao, 'CANCELADO');
  });

  // --- 18. Idempotência do DELETE ---
  await t.test('DELETE minha-participacao é idempotente', async () => {
    // Integrante já está confirmado no ensaioId. Cancela duas vezes.
    const res1 = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res1.status, 200);

    const res2 = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieIntegrante },
    });
    assert.equal(res2.status, 200);
    assert.deepEqual(await res2.json(), { participacao: null });
  });

  // --- 19. Concorrência: duas confirmações simultâneas resultam em uma única participação ---
  await t.test('confirmações simultâneas resultam em uma participação ativa', async () => {
    // Cria ensaio novo para teste isolado
    const postRes = await fetch(`${base}/api/ensaios`, {
      method: 'POST',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inicioEm: '2026-12-05T19:00:00-03:00', local: 'Concorrência teste' }),
    });
    const { ensaio: ensaioConcorrente } = await postRes.json();

    // Faz duas requisições simultâneas do mesmo usuário para o mesmo ensaio
    const [res1, res2] = await Promise.all([
      fetch(`${base}/api/ensaios/${ensaioConcorrente.id}/minha-participacao`, {
        method: 'PUT',
        headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
      }),
      fetch(`${base}/api/ensaios/${ensaioConcorrente.id}/minha-participacao`, {
        method: 'PUT',
        headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoInstrumentoId: tipoSurdo.id }),
      }),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    // Verifica que há exatamente UMA participação ativa
    const { rows } = await banco.query(
      'SELECT count(*)::integer AS total FROM confirmacoes WHERE ensaio_id = $1 AND cancelado_em IS NULL',
      [ensaioConcorrente.id],
    );
    assert.equal(rows[0].total, 1, 'Deve haver exatamente uma participação ativa após requisições simultâneas');
  });

  await t.test('transação iniciada primeiro pode gravar após outra confirmação', async () => {
    const { rows: [ensaio] } = await banco.query(
      'INSERT INTO ensaios (inicio_em, local) VALUES (clock_timestamp(), $1) RETURNING id',
      ['Gravação fora da ordem de início'],
    );
    const { rows: [integrante] } = await banco.query('SELECT id FROM usuarios WHERE email = $1', ['integrante@bateria.example']);
    const iniciou = Promise.withResolvers();
    const continuar = Promise.withResolvers();
    const repositorioAtrasado = new ConfirmacaoRepository({
      async connect() {
        const conexao = await banco.connect();
        return {
          async query(sql, params) {
            const resultado = await conexao.query(sql, params);
            if (sql === 'BEGIN') {
              iniciou.resolve();
              await continuar.promise;
            }
            return resultado;
          },
          release: () => conexao.release(),
        };
      },
    });

    const primeira = repositorioAtrasado.confirmar(ensaio.id, integrante.id, tipoSurdo.id);
    const maisRecente = async () => {
      try {
        await Promise.race([iniciou.promise, primeira]);
        await banco.query('SELECT pg_sleep(0.01)');
        return await confirmacaoRepo.confirmar(ensaio.id, integrante.id, tipoCaixa.id);
      } finally {
        continuar.resolve();
      }
    };
    const [atualizada, criada] = await Promise.all([primeira, maisRecente()]);
    assert.equal(atualizada.status, 'OK');
    assert.equal(criada.status, 'OK');
    assert.equal(atualizada.confirmacao.id, criada.confirmacao.id);
    assert.equal(atualizada.confirmacao.tipoInstrumentoId, tipoSurdo.id);
    assert.ok(atualizada.confirmacao.atualizadoEm >= criada.confirmacao.confirmadoEm);

    const repetida = await confirmacaoRepo.confirmar(ensaio.id, integrante.id, tipoSurdo.id);
    assert.deepEqual(repetida.confirmacao.toJSON(), atualizada.confirmacao.toJSON());
    await confirmacaoRepo.cancelar(ensaio.id, integrante.id);
    const { rows: [datas] } = await banco.query(
      'SELECT cancelado_em = atualizado_em AS mesmo_instante FROM confirmacoes WHERE id = $1',
      [criada.confirmacao.id],
    );
    assert.equal(datas.mesmo_instante, true);
  });

  // --- 20. PUT sem Content-Type application/json retorna 415 ---
  await t.test('PUT minha-participacao sem JSON retorna 415', async () => {
    const res = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante },
      body: 'tipoInstrumentoId=1',
    });
    assert.equal(res.status, 415);
    assert.equal((await res.json()).error.code, 'JSON_OBRIGATORIO');
  });

  // --- 21. Tentativa de alterar a participação de outra pessoa ---
  await t.test('tentativa de alterar participação de outra pessoa é rejeitada e isolada', async () => {
    // 1. Tentar passar usuarioId no corpo da requisição é rejeitado com DADOS_INVALIDOS
    const resInjecao = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id, usuarioId: 999 }),
    });
    assert.equal(resInjecao.status, 400);
    assert.equal((await resInjecao.json()).error.code, 'DADOS_INVALIDOS');

    // 2. Garantir isolamento: Diretoria tem sua participação e Integrante tem a sua
    await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieDiretoria, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoSurdo.id }),
    });

    // Integrante altera a própria para Caixa
    await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: { Cookie: cookieIntegrante, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });

    // Consulta da Diretoria permanece inalterada (Surdo)
    const resDir = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      headers: { Cookie: cookieDiretoria },
    });
    assert.equal(resDir.status, 200);
    const bodyDir = await resDir.json();
    assert.equal(bodyDir.participacao.tipoInstrumentoNome, 'Surdo');

    // Integrante cancela a própria participação; Diretoria continua ativa com Surdo
    await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'DELETE',
      headers: { Cookie: cookieIntegrante },
    });

    const resDir2 = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      headers: { Cookie: cookieDiretoria },
    });
    assert.equal(resDir2.status, 200);
    const bodyDir2 = await resDir2.json();
    assert.equal(bodyDir2.participacao.tipoInstrumentoNome, 'Surdo');
  });

  // --- 22. Proteção de mesma origem ---
  await t.test('PUT e DELETE recusam origem cruzada com 403', async () => {
    const resPut = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'PUT',
      headers: {
        Cookie: cookieIntegrante,
        'Content-Type': 'application/json',
        Origin: 'http://malicioso.example',
      },
      body: JSON.stringify({ tipoInstrumentoId: tipoCaixa.id }),
    });
    assert.equal(resPut.status, 403);
    assert.equal((await resPut.json()).error.code, 'ORIGEM_INVALIDA');

    const resDel = await fetch(`${base}/api/ensaios/${ensaioId}/minha-participacao`, {
      method: 'DELETE',
      headers: {
        Cookie: cookieIntegrante,
        Origin: 'http://malicioso.example',
      },
    });
    assert.equal(resDel.status, 403);
    assert.equal((await resDel.json()).error.code, 'ORIGEM_INVALIDA');
  });
});
