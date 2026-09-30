import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, transacao } from '../config/db.js';
import { env } from '../config/env.js';
import { ErroNegocio } from '../domain/erros.js';
import { ESTADOS_ATIVOS } from '../domain/estados.js';
import { agora, paraSQL } from '../domain/relogio.js';

const MAX_FALHAS = 5;
const JANELA_BLOQUEIO_MIN = 15;

async function registrarAcesso({ login, usuarioId = null, acao, guicheId = null, ip = null }) {
  await pool.query(
    'INSERT INTO logs_acesso (login, usuario_id, acao, guiche_id, ip, ocorrido_em) VALUES (?, ?, ?, ?, ?, ?)',
    [String(login).slice(0, 50), usuarioId, acao, guicheId, ip, paraSQL(agora())],
  );
}

/** Bloqueio temporário após falhas seguidas (proteção contra tentativa e erro de senha). */
async function loginBloqueado(login) {
  const limite = paraSQL(new Date(Date.now() - JANELA_BLOQUEIO_MIN * 60000));
  const [[{ falhas }]] = await pool.query(
    `SELECT COUNT(*) AS falhas FROM logs_acesso
      WHERE login = ? AND acao = 'LOGIN_FALHA' AND ocorrido_em >= ?
        AND ocorrido_em > COALESCE((SELECT MAX(ocorrido_em) FROM logs_acesso l2
                                     WHERE l2.login = ? AND l2.acao = 'LOGIN_OK'), '1970-01-01')`,
    [login, limite, login],
  );
  return Number(falhas) >= MAX_FALHAS;
}

/** Coloca o atendente no guichê. Recusa se outro atendente estiver com atendimento em andamento nele. */
async function ocuparGuiche(usuario, guicheId) {
  return transacao(async (conn) => {
    const [[guiche]] = await conn.query('SELECT * FROM guiches WHERE id = ? AND ativo = 1 FOR UPDATE', [guicheId]);
    if (!guiche) throw new ErroNegocio(404, 'GUICHE_INVALIDO', 'Guichê não encontrado ou inativo.');

    if (guiche.ocupante_id && guiche.ocupante_id !== usuario.id) {
      const [[{ ativos }]] = await conn.query(
        'SELECT COUNT(*) AS ativos FROM senhas WHERE guiche_id = ? AND usuario_id = ? AND estado IN (?)',
        [guicheId, guiche.ocupante_id, ESTADOS_ATIVOS],
      );
      if (Number(ativos) > 0) {
        const [[ocupante]] = await conn.query('SELECT nome FROM usuarios WHERE id = ?', [guiche.ocupante_id]);
        throw new ErroNegocio(409, 'GUICHE_OCUPADO',
          `O guichê ${guiche.numero} está com um atendimento em andamento por ${ocupante?.nome ?? 'outro atendente'}.`);
      }
    }
    await conn.query('UPDATE guiches SET ocupante_id = NULL, ocupado_desde = NULL WHERE ocupante_id = ? AND id <> ?',
      [usuario.id, guicheId]);
    await conn.query('UPDATE guiches SET ocupante_id = ?, ocupado_desde = ? WHERE id = ?',
      [usuario.id, paraSQL(agora()), guicheId]);
    return guiche;
  });
}

export function gerarToken(usuario, guiche) {
  return jwt.sign(
    {
      sub: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      perfis: { atendente: !!usuario.perfil_atendente, gestor: !!usuario.perfil_gestor },
      guicheId: guiche?.id ?? null,
      guicheNumero: guiche?.numero ?? null,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiraEm },
  );
}

export async function login({ login, senha, guicheId, ip }) {
  if (!login || !senha) throw new ErroNegocio(400, 'DADOS_INCOMPLETOS', 'Informe usuário e senha.');

  if (await loginBloqueado(login)) {
    await registrarAcesso({ login, acao: 'LOGIN_BLOQUEADO', ip });
    throw new ErroNegocio(429, 'LOGIN_BLOQUEADO',
      `Muitas tentativas sem sucesso. Tente novamente em ${JANELA_BLOQUEIO_MIN} minutos.`);
  }

  const [[usuario]] = await pool.query('SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]);
  const senhaConfere = usuario ? await bcrypt.compare(senha, usuario.senha_hash) : false;
  if (!senhaConfere) {
    await registrarAcesso({ login, usuarioId: usuario?.id, acao: 'LOGIN_FALHA', ip });
    throw new ErroNegocio(401, 'CREDENCIAIS_INVALIDAS', 'Usuário ou senha inválidos.');
  }

  let guiche = null;
  if (guicheId) {
    if (!usuario.perfil_atendente) {
      throw new ErroNegocio(403, 'SEM_PERFIL_ATENDENTE', 'Este usuário não tem perfil de atendente.');
    }
    guiche = await ocuparGuiche(usuario, Number(guicheId));
  } else if (!usuario.perfil_gestor) {
    throw new ErroNegocio(400, 'GUICHE_OBRIGATORIO', 'Escolha o guichê em que vai atender.');
  }

  await registrarAcesso({ login, usuarioId: usuario.id, acao: 'LOGIN_OK', guicheId: guiche?.id, ip });
  const token = gerarToken(usuario, guiche);
  return { token, usuario: jwt.decode(token) };
}

export async function logout({ usuarioId, login, guicheId, ip }) {
  if (guicheId) {
    await pool.query('UPDATE guiches SET ocupante_id = NULL, ocupado_desde = NULL WHERE id = ? AND ocupante_id = ?',
      [guicheId, usuarioId]);
  }
  await registrarAcesso({ login, usuarioId, acao: 'LOGOUT', guicheId, ip });
}

export async function hashSenha(senha) {
  return bcrypt.hash(senha, 10);
}
