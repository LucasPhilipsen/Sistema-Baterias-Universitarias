import { dbPool } from './database.js';
import { EnsaioRepository } from '../repositories/EnsaioRepository.js';
import { EnsaioService } from '../services/EnsaioService.js';

export const ensaioService = new EnsaioService({
  ensaios: new EnsaioRepository(dbPool),
});
