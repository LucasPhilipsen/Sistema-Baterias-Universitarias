import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { validarIdParam, validarCamposPermitidos } from '../services/EnsaioService.js';

export class EnsaioController {
  constructor(servico) {
    this.servico = servico;
  }

  async listar(req, res) {
    const chavesQuery = Object.keys(req.query);
    for (const chave of chavesQuery) {
      if (chave !== 'situacao') {
        throw new ErroAplicacao(400, 'DADOS_INVALIDOS', `Filtro não permitido ou desconhecido: ${chave}.`);
      }
    }
    const ensaios = await this.servico.listar({ situacao: req.query.situacao });
    res.status(200).json({ ensaios });
  }

  async consultar(req, res) {
    const id = validarIdParam(req.params.id);
    const ensaio = await this.servico.buscarPorId(id);
    res.status(200).json({ ensaio });
  }

  async cadastrar(req, res) {
    const ensaio = await this.servico.cadastrar(req.body);
    res.set('Location', `/api/ensaios/${ensaio.id}`);
    res.status(201).json({ ensaio });
  }

  async editar(req, res) {
    const id = validarIdParam(req.params.id);
    const ensaio = await this.servico.editar(id, req.body);
    res.status(200).json({ ensaio });
  }

  async cancelar(req, res) {
    const id = validarIdParam(req.params.id);
    validarCamposPermitidos(req.body, []);
    const ensaio = await this.servico.cancelar(id);
    res.status(200).json({ ensaio });
  }
}

