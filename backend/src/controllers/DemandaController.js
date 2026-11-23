export class DemandaController {
  constructor(servico) {
    this.servico = servico;
  }

  async consultar(req, res) {
    res.status(200).json({ demanda: await this.servico.consultar(req.params.id, req.query) });
  }
}
