// Opt-in de integração com os módulos publicados da SCRUM-43 em outro checkout.
// Rotas, sessão, serviço, entidade e cálculo reais; persistência e movimentações simuladas.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { scheduledEnsaio, otherEnsaio, cancelledEnsaio } from './demanda-fixtures.js';

export async function externalDemandaApi(root) {
  if (process.env.NODE_ENV !== 'test' || !root) throw new Error('Use somente em testes, com checkout explícito do backend de demanda.');
  const load = path => import(pathToFileURL(resolve(root, 'backend/src', path)).href);
  const [{ createApp }, { Usuario }, { Ensaio }, { AuthService }, { SenhaService }, { DemandaService }, { errorHandler }, { exigirAutenticacao, exigirDiretoria }] = await Promise.all([
    load('app.js'), load('entities/Usuario.js'), load('entities/Ensaio.js'), load('services/AuthService.js'),
    load('services/SenhaService.js'), load('services/DemandaService.js'), load('middlewares/errorHandler.js'), load('middlewares/autenticacao.js'),
  ]);
  const seed = await readFile(new URL('../../../database/seeds/001-usuarios-desenvolvimento.sql', import.meta.url), 'utf8');
  const hashes = [...seed.matchAll(/scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}/g)].map(([hash]) => hash);
  const usuarios = new Map([
    [1, new Usuario({ id: 1, nome: 'Diretoria de Demonstração', email: 'diretoria@bateria.example', senhaHash: hashes[0], perfil: 'DIRETORIA' })],
    [2, new Usuario({ id: 2, nome: 'Integrante de Demonstração', email: 'integrante@bateria.example', senhaHash: hashes[1], perfil: 'INTEGRANTE' })],
  ]);
  const sessoes = new Map();
  const authService = new AuthService({
    usuarios: { buscarPorEmail: async email => [...usuarios.values()].find(item => item.email === email) ?? null },
    sessoes: {
      criar: async registro => { sessoes.delete(registro.tokenAnteriorHash); sessoes.set(registro.tokenHash, registro); },
      buscarUsuarioPorHash: async hash => {
        const registro = sessoes.get(hash);
        return registro && registro.expiraEm > new Date() ? usuarios.get(registro.usuarioId) : null;
      },
      removerPorHash: async hash => sessoes.delete(hash),
    }, senhas: new SenhaService(),
  });
  const ensaios = [scheduledEnsaio, otherEnsaio, cancelledEnsaio].map(item => new Ensaio(item));
  const tipos = [{ id: 83, nome: 'Caixa' }, { id: 128, nome: 'Repinique' }, { id: 371, nome: 'Surdo sem unidades' }];
  const unidades = [83, 83, 83, 128, 128].map(tipoInstrumentoId => ({ tipoInstrumentoId, situacao: 'DISPONIVEL' }));
  unidades.push({ tipoInstrumentoId: 83, situacao: 'EMPRESTADO' }, { tipoInstrumentoId: 83, situacao: 'EM_MANUTENCAO' });
  const confirmacoes = [83, 83, 83, 83, 83, 371, 371].map(tipoInstrumentoId => ({ tipoInstrumentoId, ensaioId: scheduledEnsaio.id, ativa: true }));
  confirmacoes.push({ tipoInstrumentoId: 83, ensaioId: otherEnsaio.id, ativa: true }, { tipoInstrumentoId: 83, ensaioId: scheduledEnsaio.id, ativa: false });
  const ensaioRepository = {
    buscarPorId: async id => ensaios.find(item => item.id === id) ?? null,
    listar: async ({ situacao } = {}) => ensaios.filter(item => !situacao || item.situacao === situacao),
  };
  const { EnsaioService } = await load('services/EnsaioService.js');
  const demandaService = new DemandaService({ ensaios: ensaioRepository, demanda: {
    contarPorTipo: async ensaioId => tipos.map(tipo => ({ tipoInstrumentoId: tipo.id, nome: tipo.nome,
      confirmados: confirmacoes.filter(item => item.ensaioId === ensaioId && item.tipoInstrumentoId === tipo.id && item.ativa).length,
      disponiveis: unidades.filter(item => item.tipoInstrumentoId === tipo.id && item.situacao === 'DISPONIVEL').length,
    })),
  } });
  const app = createApp({ authService, ensaioService: new EnsaioService({ ensaios: ensaioRepository }), demandaService, limiteTentativas: 1000 });
  // Apenas a alteração do repositório de testes. Não representa a API real de empréstimos.
  app.post('/api/e2e/demanda/retirada', exigirAutenticacao(authService), exigirDiretoria, (req, res) => {
    const unidade = unidades.find(item => item.tipoInstrumentoId === tipos[0].id && item.situacao === 'DISPONIVEL');
    if (unidade) unidade.situacao = 'EMPRESTADO';
    res.json({ simulado: true });
  });
  app.use(errorHandler);
  return { app, authService };
}
