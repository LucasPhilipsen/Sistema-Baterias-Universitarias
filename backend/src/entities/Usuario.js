export const PerfilUsuario = Object.freeze({
  DIRETORIA: 'DIRETORIA',
  INTEGRANTE: 'INTEGRANTE',
});

const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const formatoHash = /^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/;

export class Usuario {
  #id;
  #nome;
  #email;
  #senhaHash;
  #perfil;

  constructor({ id = null, nome, email, senhaHash, perfil }) {
    if (id !== null && (!Number.isInteger(id) || id < 1 || id > 2147483647)) {
      throw new TypeError('Identificação de usuário inválida.');
    }

    if (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 120) {
      throw new TypeError('Nome deve ter entre 1 e 120 caracteres.');
    }

    if (typeof email !== 'string' || email.trim().length > 254 || !formatoEmail.test(email.trim())) {
      throw new TypeError('E-mail inválido.');
    }

    if (!Object.values(PerfilUsuario).includes(perfil)) {
      throw new TypeError('Perfil de usuário inválido.');
    }

    if (typeof senhaHash !== 'string' || senhaHash.length !== 179 || !formatoHash.test(senhaHash)) {
      throw new TypeError('A senha deve ser fornecida como hash scrypt no formato definido.');
    }

    this.#id = id;
    this.#nome = nome.trim();
    this.#email = email.trim().toLowerCase();
    this.#senhaHash = senhaHash;
    this.#perfil = perfil;
  }

  get id() { return this.#id; }
  get nome() { return this.#nome; }
  get email() { return this.#email; }
  get senhaHash() { return this.#senhaHash; }
  get perfil() { return this.#perfil; }

  ehDiretoria() {
    return this.#perfil === PerfilUsuario.DIRETORIA;
  }

  toJSON() {
    return {
      id: this.#id,
      nome: this.#nome,
      email: this.#email,
      perfil: this.#perfil,
    };
  }
}
