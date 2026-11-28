export class ManutencaoController {
  constructor(servico) { this.servico = servico; }

  async listar(req, res) {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ manutencoes: await this.servico.listar(req.params.instrumentoId, req.query) });
  }

  async abrir(req, res) {
    const manutencao = await this.servico.abrir(req.params.instrumentoId, req.body, req.query);
    res.status(201).json({ manutencao });
  }

  async encerrar(req, res) {
    const manutencao = await this.servico.encerrar(req.params.instrumentoId, req.params.manutencaoId, req.body, req.query);
    res.status(200).json({ manutencao });
  }
}
