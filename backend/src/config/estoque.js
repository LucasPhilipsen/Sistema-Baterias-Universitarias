import { dbPool } from './database.js';
import { TipoInstrumentoRepository } from '../repositories/TipoInstrumentoRepository.js';
import { InstrumentoRepository } from '../repositories/InstrumentoRepository.js';
import { TipoInstrumentoService } from '../services/TipoInstrumentoService.js';
import { InstrumentoService } from '../services/InstrumentoService.js';
import { EstoqueService } from '../services/EstoqueService.js';

export function criarServicosEstoque(banco) {
  const instrumentos = new InstrumentoRepository(banco);
  return {
    tipos: new TipoInstrumentoService(new TipoInstrumentoRepository(banco)),
    instrumentos: new InstrumentoService(instrumentos),
    estoque: new EstoqueService(instrumentos),
  };
}

export const servicosEstoque = criarServicosEstoque(dbPool);
