import { dbPool } from './database.js';
import { ManutencaoRepository } from '../repositories/ManutencaoRepository.js';
import { ManutencaoService } from '../services/ManutencaoService.js';

export function criarServicoManutencoes(banco) {
  return new ManutencaoService(new ManutencaoRepository(banco));
}

export const manutencaoService = criarServicoManutencoes(dbPool);
