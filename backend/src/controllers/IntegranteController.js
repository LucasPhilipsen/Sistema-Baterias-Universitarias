export class IntegranteController {
  constructor(servico) {
    this.servico = servico;
  }

  async listar(req, res) {
    res.json({ integrantes: await this.servico.listar(req.query) });
  }

  async consultar(req, res) {
    res.json({ integrante: await this.servico.consultar(req.params.id, req.query) });
  }

  async cadastrar(req, res) {
    const integrante = await this.servico.cadastrar(req.body, req.query);
    res.status(201).location(`/api/integrantes/${integrante.id}`).json({ integrante });
  }

  async atualizar(req, res) {
    res.json({ integrante: await this.servico.atualizar(req.params.id, req.body, req.query) });
  }
}
