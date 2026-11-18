import { dbPool } from './database.js';
import { UsuarioRepository } from '../repositories/UsuarioRepository.js';
import { IntegranteService } from '../services/IntegranteService.js';
import { SenhaService } from '../services/SenhaService.js';

export const integranteService = new IntegranteService({
  usuarios: new UsuarioRepository(dbPool),
  senhas: new SenhaService(),
});
