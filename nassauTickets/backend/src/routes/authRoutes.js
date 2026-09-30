import { Router } from 'express';
import { autenticar } from '../middlewares/autenticacao.js';
import { limitePorIp } from '../middlewares/limiteRequisicoes.js';
import { login, logout } from '../services/authService.js';

const rotas = Router();
const assinc = (fn) => (req, res, next) => fn(req, res, next).catch(next);

rotas.post('/login', limitePorIp({ maximo: 20, janelaMs: 60000 }), assinc(async (req, res) => {
  const { login: usuario, senha, guicheId } = req.body || {};
  res.json(await login({ login: usuario, senha, guicheId, ip: req.ip }));
}));

rotas.post('/logout', autenticar, assinc(async (req, res) => {
  await logout({ usuarioId: req.usuario.id, login: req.usuario.login, guicheId: req.usuario.guicheId, ip: req.ip });
  res.status(204).end();
}));

rotas.get('/eu', autenticar, (req, res) => res.json(req.usuario));

export default rotas;
