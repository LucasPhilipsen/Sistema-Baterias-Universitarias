import { HttpError } from '../services/http.js';

export function readIntegrante(value) {
  if (!Number.isInteger(value?.id) || value.id < 1 || value.id > 2147483647
    || typeof value.nome !== 'string' || !value.nome.trim() || typeof value.email !== 'string'
    || !value.email.trim() || value.perfil !== 'INTEGRANTE') throw new Error('Integrante inválido.');
  // A interface mantém apenas os campos públicos do contrato.
  const { id, nome, email, perfil } = value;
  return { id, nome, email, perfil };
}

export function readIntegrantes(data) {
  if (!Array.isArray(data?.integrantes)) throw new Error('Lista inválida.');
  const integrantes = data.integrantes.map(readIntegrante);
  if (new Set(integrantes.map(item => item.id)).size !== integrantes.length) throw new Error('Lista inválida.');
  return integrantes;
}

export function validateIntegrante(values, creating) {
  const errors = {};
  const nome = values.nome.trim();
  const email = values.email.trim().toLowerCase();
  if (!nome || nome.length > 120 || nome.includes('\0')) errors.nome = 'Informe um nome de 1 a 120 caracteres.';
  if (email.length > 254 || email.includes('\0') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Informe um e-mail válido de até 254 caracteres.';
  const body = { nome, email };
  if (creating) {
    if ([...values.senha].length < 12 || new TextEncoder().encode(values.senha).length > 1024) errors.senha = 'Informe uma senha de pelo menos 12 caracteres e até 1024 bytes.';
    body.senha = values.senha;
  }
  return { errors, body };
}

export function integranteError(error, saving = false) {
  if (error instanceof HttpError) {
    const code = error.data?.error?.code;
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
    if (code === 'ORIGEM_INVALIDA') return 'O servidor recusou a origem do acesso. Abra o sistema pelo endereço configurado.';
    if (error.status === 403) return 'Acesso restrito à diretoria. Sua conta não pode realizar esta operação.';
    if (code === 'EMAIL_DUPLICADO') return 'Já existe uma conta com este e-mail.';
    if (error.status === 404) return 'Integrante não encontrado. Atualize a lista e consulte novamente.';
    if (error.status === 400) return 'Confira os dados informados. Nome, e-mail ou senha não atendem ao cadastro.';
    if (error.status === 415) return 'O servidor não aceitou o formato do cadastro. Recarregue a página e tente novamente.';
  }
  return saving ? 'Não foi possível confirmar a gravação. Atualize a lista antes de tentar salvar novamente.'
    : 'Não foi possível carregar os integrantes. Verifique sua conexão e tente novamente.';
}
