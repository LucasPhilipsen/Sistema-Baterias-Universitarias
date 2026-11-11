// Somente para testes: preserva serviços e rotas reais, simulando a persistência.
import { TipoInstrumento } from '../../../backend/src/entities/TipoInstrumento.js';
import { Instrumento } from '../../../backend/src/entities/Instrumento.js';
import { ErroAplicacao } from '../../../backend/src/errors/ErroAplicacao.js';
import { TipoInstrumentoService } from '../../../backend/src/services/TipoInstrumentoService.js';
import { InstrumentoService } from '../../../backend/src/services/InstrumentoService.js';
import { EstoqueService } from '../../../backend/src/services/EstoqueService.js';

export async function memoryEstoque() {
  const tipos = new Map();
  const unidades = new Map();
  let nextType = 73;
  let nextUnit = 801;
  function saveTipo(id, value) {
    if ([...tipos.values()].some(tipo => tipo.id !== id && tipo.nome.toLowerCase() === value.nome.toLowerCase())) throw new ErroAplicacao(409, 'TIPO_INSTRUMENTO_DUPLICADO', 'Tipo duplicado.');
    const tipo = new TipoInstrumento({ id, nome: value.nome });
    tipos.set(id, tipo);
    return tipo;
  }
  const typeRepo = {
    listar: async () => [...tipos.values()].sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id),
    buscarPorId: async id => tipos.get(id) ?? null,
    criar: async tipo => saveTipo(nextType++, tipo),
    atualizar: async (id, tipo) => tipos.has(id) ? saveTipo(id, tipo) : null,
  };
  function saveUnit(id, value, situacao) {
    if (!tipos.has(value.tipoInstrumentoId)) throw new ErroAplicacao(400, 'TIPO_INSTRUMENTO_INVALIDO', 'Tipo inexistente.');
    if ([...unidades.values()].some(unidade => unidade.id !== id && unidade.identificacao === value.identificacao)) throw new ErroAplicacao(409, 'IDENTIFICACAO_DUPLICADA', 'Identificação duplicada.');
    const unidade = new Instrumento({ ...value.toJSON(), id, situacao });
    unidades.set(id, unidade);
    return unidade;
  }
  const unitRepo = {
    listar: async ({ tipoInstrumentoId, situacao }) => [...unidades.values()].filter(unidade => (tipoInstrumentoId === null || unidade.tipoInstrumentoId === tipoInstrumentoId) && (situacao === null || unidade.situacao === situacao)).sort((a, b) => a.identificacao.localeCompare(b.identificacao) || a.id - b.id),
    buscarPorId: async id => unidades.get(id) ?? null,
    criar: async unidade => saveUnit(nextUnit++, unidade, 'DISPONIVEL'),
    atualizar: async (id, unidade) => {
      const original = unidades.get(id);
      if (!original) return null;
      if (original.tipoInstrumentoId !== unidade.tipoInstrumentoId && !original.estaDisponivel()) throw new ErroAplicacao(409, 'INSTRUMENTO_INDISPONIVEL', 'Unidade indisponível.');
      return saveUnit(id, unidade, original.situacao);
    },
    resumirPorTipo: async () => (await typeRepo.listar()).map(tipo => {
      const rows = [...unidades.values()].filter(unidade => unidade.tipoInstrumentoId === tipo.id);
      const count = situacao => rows.filter(unidade => unidade.situacao === situacao).length;
      return { tipoInstrumentoId: tipo.id, nome: tipo.nome, total: rows.length, disponiveis: count('DISPONIVEL'), emprestados: count('EMPRESTADO'), emManutencao: count('EM_MANUTENCAO') };
    }),
  };
  const caixa = await typeRepo.criar(new TipoInstrumento({ nome: 'Caixa de teste' }));
  await typeRepo.criar(new TipoInstrumento({ nome: 'Tipo sem unidades' }));
  for (const [identificacao, situacao] of [['E2E-DISPONIVEL', 'DISPONIVEL'], ['E2E-EMPRESTADO', 'EMPRESTADO'], ['E2E-MANUTENCAO', 'EM_MANUTENCAO']]) {
    saveUnit(nextUnit++, new Instrumento({ tipoInstrumentoId: caixa.id, identificacao }), situacao);
  }
  return { tipos: new TipoInstrumentoService(typeRepo), instrumentos: new InstrumentoService(unitRepo), estoque: new EstoqueService(unitRepo) };
}
