import { dbPool } from './database.js';
import { DemandaRepository } from '../repositories/DemandaRepository.js';
import { EnsaioRepository } from '../repositories/EnsaioRepository.js';
import { DemandaService } from '../services/DemandaService.js';

export function criarDemandaService(banco) {
  return new DemandaService({
    ensaios: new EnsaioRepository(banco),
    demanda: new DemandaRepository(banco),
  });
}

export const demandaService = criarDemandaService(dbPool);
