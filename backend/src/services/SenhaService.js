import { scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);
const formato = /^scrypt\$131072\$8\$1\$([0-9a-f]{32})\$([0-9a-f]{128})$/;

export class SenhaService {
  async verificar(senha, hash) {
    if (typeof senha !== 'string' || typeof hash !== 'string' || hash.length !== 179) return false;
    const partes = formato.exec(hash);
    if (!partes) return false;
    const esperado = Buffer.from(partes[2], 'hex');
    const recebido = await derivar(senha, Buffer.from(partes[1], 'hex'), 64, {
      N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024,
    });
    return timingSafeEqual(recebido, esperado);
  }
}
