import { dbPool } from './database.js';
import { EmprestimoRepository } from '../repositories/EmprestimoRepository.js';
import { UsuarioRepository } from '../repositories/UsuarioRepository.js';
import { EmprestimoService } from '../services/EmprestimoService.js';

export function criarServicoEmprestimos(banco) {
  return new EmprestimoService(new EmprestimoRepository(banco), new UsuarioRepository(banco));
}

export const emprestimoService = criarServicoEmprestimos(dbPool);
