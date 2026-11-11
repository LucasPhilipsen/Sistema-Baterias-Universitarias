import { ErroAplicacao } from '../errors/ErroAplicacao.js';
import { validarIdParam, validarCamposPermitidos } from '../services/EnsaioService.js';

function validarSemParametrosConsulta(query) {
  const chaves = Object.keys(query);
  if (chaves.length > 0) {
    throw new ErroAplicacao(400, 'DADOS_INVALIDOS', `Parâmetro de consulta não permitido: ${chaves[0]}.`);
  }
}

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
    validarSemParametrosConsulta(req.query);
    const id = validarIdParam(req.params.id);
    const ensaio = await this.servico.buscarPorId(id);
    res.status(200).json({ ensaio });
  }

  async cadastrar(req, res) {
    validarSemParametrosConsulta(req.query);
    const ensaio = await this.servico.cadastrar(req.body);
    res.set('Location', `/api/ensaios/${ensaio.id}`);
    res.status(201).json({ ensaio });
  }

  async editar(req, res) {
    validarSemParametrosConsulta(req.query);
    const id = validarIdParam(req.params.id);
    const ensaio = await this.servico.editar(id, req.body);
    res.status(200).json({ ensaio });
  }

  async cancelar(req, res) {
    validarSemParametrosConsulta(req.query);
    const id = validarIdParam(req.params.id);
    validarCamposPermitidos(req.body, []);
    const ensaio = await this.servico.cancelar(id);
    res.status(200).json({ ensaio });
  }
}
