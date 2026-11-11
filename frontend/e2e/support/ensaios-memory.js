// Exclusivo dos testes. Usa serviço, entidade, validação e rotas reais; substitui a persistência.
import { Ensaio } from '../../../backend/src/entities/Ensaio.js';
import { EnsaioService } from '../../../backend/src/services/EnsaioService.js';

export function memoryEnsaios() {
  const registros = new Map();
  let sequence = 70;
  return new EnsaioService({ ensaios: {
    async listar({ situacao } = {}) {
      return [...registros.values()].filter(ensaio => !situacao || ensaio.situacao === situacao)
        .sort((a, b) => Date.parse(a.inicioEm) - Date.parse(b.inicioEm) || a.id - b.id);
    },
    async buscarPorId(id) { return registros.get(id) ?? null; },
    async criar(dados) {
      const ensaio = new Ensaio({ ...dados, id: ++sequence });
      registros.set(ensaio.id, ensaio);
      return ensaio;
    },
    async atualizar(id, dados) {
      const current = registros.get(id);
      if (!current) return { encontrado: false };
      if (current.estaCancelado()) return { encontrado: true, cancelado: true };
      const ensaio = new Ensaio({ ...dados, id });
      registros.set(id, ensaio);
      return { encontrado: true, cancelado: false, ensaio };
    },
    async cancelar(id) {
      const current = registros.get(id);
      if (!current) return null;
      const ensaio = new Ensaio({ ...current.toJSON(), situacao: 'CANCELADO' });
      registros.set(id, ensaio);
      return ensaio;
    },
  } });
}
