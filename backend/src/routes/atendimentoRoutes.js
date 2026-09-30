import { Router } from 'express';
import { ErroNegocio } from '../domain/erros.js';
import { autenticar, exigirPerfil, exigirGuiche } from '../middlewares/autenticacao.js';
import {
  chamarProxima, chamarNovamente, iniciarAtendimento, finalizarAtendimento,
  registrarNaoComparecimento, senhaAtivaDoAtendente, senhaParaJSON, historicoDoDia,
} from '../services/atendimentoService.js';

const rotas = Router();
const assinc = (fn) => (req, res, next) => fn(req, res, next).catch(next);
rotas.use(autenticar, exigirPerfil('atendente'), exigirGuiche);

const idDaSenha = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new ErroNegocio(400, 'ID_INVALIDO', 'Identificador de senha inválido.');
  return id;
};

rotas.get('/atual', assinc(async (req, res) => {
  res.json({ senha: senhaParaJSON(await senhaAtivaDoAtendente(req.usuario.id)) });
}));

rotas.get('/historico', assinc(async (req, res) => {
  res.json(await historicoDoDia(req.usuario.id));
}));

rotas.post('/chamar-proxima', assinc(async (req, res) => {
  const senha = await chamarProxima({ usuarioId: req.usuario.id, guicheId: req.usuario.guicheId });
  if (!senha) return res.status(200).json({ senha: null, mensagem: 'Não há senhas aguardando.' });
  res.status(201).json({ senha });
}));

rotas.post('/senhas/:id/chamar-novamente', assinc(async (req, res) => {
  res.json({ senha: await chamarNovamente({ senhaId: idDaSenha(req), usuarioId: req.usuario.id }) });
}));

rotas.post('/senhas/:id/iniciar', assinc(async (req, res) => {
  res.json({ senha: await iniciarAtendimento({ senhaId: idDaSenha(req), usuarioId: req.usuario.id }) });
}));

rotas.post('/senhas/:id/finalizar', assinc(async (req, res) => {
  res.json({ senha: await finalizarAtendimento({ senhaId: idDaSenha(req), usuarioId: req.usuario.id }) });
}));

rotas.post('/senhas/:id/nao-compareceu', assinc(async (req, res) => {
  res.json({ senha: await registrarNaoComparecimento({ senhaId: idDaSenha(req), usuarioId: req.usuario.id }) });
}));

export default rotas;
