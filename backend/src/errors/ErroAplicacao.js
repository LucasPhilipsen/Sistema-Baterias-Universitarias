export class ErroAplicacao extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ErroAplicacao';
    this.status = status;
    this.code = code;
  }
}
