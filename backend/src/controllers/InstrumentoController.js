export class InstrumentoController {
  constructor(servico) {
    this.servico = servico;
  }

  async listar(req, res) {
    res.status(200).json({ instrumentos: await this.servico.listar(req.query) });
  }

  async consultar(req, res) {
    res.status(200).json({ instrumento: await this.servico.consultar(req.params.id) });
  }

  async cadastrar(req, res) {
    const instrumento = await this.servico.cadastrar(req.body);
    res.status(201).location(`/api/instrumentos/${instrumento.id}`).json({ instrumento });
  }

  async atualizar(req, res) {
    res.status(200).json({ instrumento: await this.servico.atualizar(req.params.id, req.body) });
  }
}
