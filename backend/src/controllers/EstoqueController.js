export class EstoqueController {
  constructor(servico) {
    this.servico = servico;
  }

  async resumir(req, res) {
    res.status(200).json({ estoque: await this.servico.resumir(req.query) });
  }
}
