import {
  validarIdEnsaioParam,
  validarSemParametrosConsulta,
  validarCorpoConfirmacao,
} from '../services/ConfirmacaoService.js';

export class ConfirmacaoController {
  constructor(servico) {
    this.servico = servico;
  }

  async consultar(req, res) {
    validarSemParametrosConsulta(req.query);
    const ensaioId = validarIdEnsaioParam(req.params.id);
    const participacao = await this.servico.consultar(ensaioId, req.usuario.id);
    const corpo = participacao ? (typeof participacao.toJSON === 'function' ? participacao.toJSON() : participacao) : null;
    res.status(200).json({ participacao: corpo });
  }

  async confirmar(req, res) {
    validarSemParametrosConsulta(req.query);
    const ensaioId = validarIdEnsaioParam(req.params.id);
    const tipoInstrumentoId = validarCorpoConfirmacao(req.body);
    const participacao = await this.servico.confirmar(ensaioId, req.usuario.id, tipoInstrumentoId);
    const corpo = participacao && typeof participacao.toJSON === 'function' ? participacao.toJSON() : participacao;
    res.status(200).json({ participacao: corpo });
  }

  async cancelar(req, res) {
    validarSemParametrosConsulta(req.query);
    const ensaioId = validarIdEnsaioParam(req.params.id);
    await this.servico.cancelar(ensaioId, req.usuario.id);
    res.status(200).json({ participacao: null });
  }
}
