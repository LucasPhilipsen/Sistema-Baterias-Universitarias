export class EmprestimoController {
  constructor(servico) {
    this.servico = servico;
  }

  async listar(req, res) {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ emprestimos: await this.servico.listar(req.usuario, req.query) });
  }

  async cadastrar(req, res) {
    const emprestimo = await this.servico.cadastrar(req.body, req.query);
    res.status(201).json({ emprestimo });
  }

  async devolver(req, res) {
    const emprestimo = await this.servico.devolver(req.params.id, req.body, req.query);
    res.status(200).json({ emprestimo });
  }
}
