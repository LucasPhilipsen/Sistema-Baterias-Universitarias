import { dbPool } from './database.js';
import { UsuarioRepository } from '../repositories/UsuarioRepository.js';
import { SessaoRepository } from '../repositories/SessaoRepository.js';
import { SenhaService } from '../services/SenhaService.js';
import { AuthService } from '../services/AuthService.js';

export const authService = new AuthService({
  usuarios: new UsuarioRepository(dbPool),
  sessoes: new SessaoRepository(dbPool),
  senhas: new SenhaService(),
});
