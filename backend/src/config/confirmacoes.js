import { dbPool } from './database.js';
import { ConfirmacaoRepository } from '../repositories/ConfirmacaoRepository.js';
import { ConfirmacaoService } from '../services/ConfirmacaoService.js';

export const confirmacaoService = new ConfirmacaoService({
  confirmacoes: new ConfirmacaoRepository(dbPool),
});
