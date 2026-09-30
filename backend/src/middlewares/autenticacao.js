import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { ErroNegocio } from '../domain/erros.js';

/** Exige token válido e usuário ainda ativo. */
export async function autenticar(req, _res, next) {
  try {
    const [tipo, token] = String(req.headers.authorization || '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new ErroNegocio(401, 'NAO_AUTENTICADO', 'Faça login para continuar.');
    let dados;
    try {
      dados = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new ErroNegocio(401, 'SESSAO_EXPIRADA', 'Sua sessão expirou. Entre novamente.');
    }
    const [[u]] = await pool.query('SELECT id, ativo FROM usuarios WHERE id = ?', [dados.sub]);
    if (!u || !u.ativo) throw new ErroNegocio(401, 'USUARIO_INATIVO', 'Usuário inativo.');
    req.usuario = { id: dados.sub, nome: dados.nome, login: dados.login, perfis: dados.perfis,
      guicheId: dados.guicheId, guicheNumero: dados.guicheNumero };
    next();
  } catch (erro) {
    next(erro);
  }
}

export function exigirPerfil(perfil) {
  return (req, _res, next) => {
    if (!req.usuario?.perfis?.[perfil]) {
      return next(new ErroNegocio(403, 'SEM_PERMISSAO', `Acesso restrito ao perfil ${perfil}.`));
    }
    next();
  };
}

/** Garante que o atendente ainda ocupa o guichê do seu login (outro pode tê-lo assumido). */
export async function exigirGuiche(req, _res, next) {
  try {
    if (!req.usuario.guicheId) throw new ErroNegocio(409, 'SEM_GUICHE', 'Entre informando o guichê para atender.');
    const [[g]] = await pool.query('SELECT ocupante_id, ativo FROM guiches WHERE id = ?', [req.usuario.guicheId]);
    if (!g || !g.ativo || g.ocupante_id !== req.usuario.id) {
      throw new ErroNegocio(409, 'GUICHE_LIBERADO', 'Você não está mais neste guichê. Entre novamente.');
    }
    next();
  } catch (erro) {
    next(erro);
  }
}
