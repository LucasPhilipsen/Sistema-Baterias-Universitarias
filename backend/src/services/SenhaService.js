import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);
const formato = /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/;
const parametros = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export class SenhaService {
  async gerarHash(senha) {
    const salt = randomBytes(16);
    const hash = await derivar(senha, salt, 64, parametros);
    return `scrypt$131072$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
  }

  async verificar(senha, hash) {
    if (typeof senha !== 'string' || typeof hash !== 'string' || hash.length !== 179) return false;
    const partes = formato.exec(hash);
    if (!partes) return false;
    const esperado = Buffer.from(partes[2], 'hex');
    const recebido = await derivar(senha, Buffer.from(partes[1], 'hex'), 64, parametros);
    return timingSafeEqual(recebido, esperado);
  }
}
