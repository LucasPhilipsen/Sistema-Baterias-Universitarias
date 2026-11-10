import { Router } from 'express';
import { EstoqueController } from '../controllers/EstoqueController.js';
import { InstrumentoController } from '../controllers/InstrumentoController.js';
import { TipoInstrumentoController } from '../controllers/TipoInstrumentoController.js';
import { exigirAutenticacao, exigirDiretoria, exigirJsonMesmaOrigem } from '../middlewares/autenticacao.js';

// Ambos os perfis consultam; somente a diretoria cadastra ou edita, sempre com JSON da mesma origem.
export function createEstoqueRouter({ authService, tipos, instrumentos, estoque }) {
  const router = Router();
  const consultar = exigirAutenticacao(authService);
  const alterar = [consultar, exigirDiretoria, exigirJsonMesmaOrigem];
  const tiposController = new TipoInstrumentoController(tipos);
  const instrumentosController = new InstrumentoController(instrumentos);
  const estoqueController = new EstoqueController(estoque);

  router.get('/tipos-instrumentos', consultar, (req, res) => tiposController.listar(req, res));
  router.post('/tipos-instrumentos', alterar, (req, res) => tiposController.cadastrar(req, res));
  router.get('/tipos-instrumentos/:id', consultar, (req, res) => tiposController.consultar(req, res));
  router.put('/tipos-instrumentos/:id', alterar, (req, res) => tiposController.atualizar(req, res));

  router.get('/instrumentos', consultar, (req, res) => instrumentosController.listar(req, res));
  router.post('/instrumentos', alterar, (req, res) => instrumentosController.cadastrar(req, res));
  router.get('/instrumentos/:id', consultar, (req, res) => instrumentosController.consultar(req, res));
  router.put('/instrumentos/:id', alterar, (req, res) => instrumentosController.atualizar(req, res));

  router.get('/estoque', consultar, (req, res) => estoqueController.resumir(req, res));
  return router;
}
