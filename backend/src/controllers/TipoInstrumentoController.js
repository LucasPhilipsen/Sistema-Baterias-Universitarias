export class TipoInstrumentoController {
  constructor(servico) {
    this.servico = servico;
  }

  async listar(req, res) {
    res.status(200).json({ tiposInstrumentos: await this.servico.listar(req.query) });
  }

  async consultar(req, res) {
    res.status(200).json({ tipoInstrumento: await this.servico.consultar(req.params.id) });
  }

  async cadastrar(req, res) {
    const tipoInstrumento = await this.servico.cadastrar(req.body);
    res.status(201).location(`/api/tipos-instrumentos/${tipoInstrumento.id}`).json({ tipoInstrumento });
  }

  async atualizar(req, res) {
    res.status(200).json({ tipoInstrumento: await this.servico.atualizar(req.params.id, req.body) });
  }
}
