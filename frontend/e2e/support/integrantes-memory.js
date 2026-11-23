import { Usuario } from '../../../backend/src/entities/Usuario.js';
import { ErroAplicacao } from '../../../backend/src/errors/ErroAplicacao.js';
import { IntegranteService } from '../../../backend/src/services/IntegranteService.js';
import { SenhaService } from '../../../backend/src/services/SenhaService.js';

// Compartilha os usuários com o login real do servidor de testes.
export function memoryIntegrantes(usuarios) {
  const publicUser = usuario => usuario?.perfil === 'INTEGRANTE' ? usuario.toJSON() : null;
  const checkEmail = (email, id) => {
    if ([...usuarios.values()].some(item => item.email === email && item.id !== id)) {
      throw new ErroAplicacao(409, 'EMAIL_DUPLICADO', 'Já existe uma conta com este e-mail.');
    }
  };
  return new IntegranteService({ senhas: new SenhaService(), usuarios: {
    listarIntegrantes: async () => [...usuarios.values()].filter(item => item.perfil === 'INTEGRANTE').sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id).map(item => item.toJSON()),
    buscarIntegrantePorId: async id => publicUser(usuarios.get(id)),
    criarIntegrante: async data => {
      checkEmail(data.email);
      const id = Math.max(72, ...usuarios.keys()) + 1;
      const usuario = new Usuario({ ...data, id, perfil: 'INTEGRANTE' });
      usuarios.set(id, usuario);
      return usuario.toJSON();
    },
    atualizarIntegrante: async (id, data) => {
      const original = usuarios.get(id);
      if (!publicUser(original)) return null;
      checkEmail(data.email, id);
      const usuario = new Usuario({ ...data, id, senhaHash: original.senhaHash, perfil: original.perfil });
      usuarios.set(id, usuario);
      return usuario.toJSON();
    },
  } });
}
