import { pool } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { ESTADOS_ATIVOS } from '../domain/estados.js';
import { hashSenha } from './authService.js';

const LOGIN_VALIDO = /^[a-z0-9._-]{3,50}$/;

function usuarioParaJSON(u) {
  return {
    id: u.id,
    nome: u.nome,
    login: u.login,
    perfilAtendente: !!u.perfil_atendente,
    perfilGestor: !!u.perfil_gestor,
    ativo: !!u.ativo,
    criadoEm: u.criado_em,
  };
}

export async function listarUsuarios() {
  const [linhas] = await pool.query('SELECT * FROM usuarios ORDER BY nome');
  return linhas.map(usuarioParaJSON);
}

function validarUsuario({ nome, login, senha }, criando) {
  if (!nome || String(nome).trim().length < 3) throw new ErroNegocio(400, 'NOME_INVALIDO', 'Informe o nome completo.');
  if (!LOGIN_VALIDO.test(String(login || ''))) {
    throw new ErroNegocio(400, 'LOGIN_INVALIDO', 'O usuário deve ter de 3 a 50 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.');
  }
  if ((criando || senha) && String(senha || '').length < 6) {
    throw new ErroNegocio(400, 'SENHA_FRACA', 'A senha deve ter pelo menos 6 caracteres.');
  }
}

export async function criarUsuario(dados) {
  validarUsuario(dados, true);
  const perfilAtendente = dados.perfilAtendente !== false;
  const perfilGestor = !!dados.perfilGestor;
  if (!perfilAtendente && !perfilGestor) throw new ErroNegocio(400, 'SEM_PERFIL', 'Escolha ao menos um perfil.');
  try {
    const [r] = await pool.query(
      'INSERT INTO usuarios (nome, login, senha_hash, perfil_atendente, perfil_gestor, ativo) VALUES (?, ?, ?, ?, ?, 1)',
      [dados.nome.trim(), dados.login, await hashSenha(dados.senha), perfilAtendente, perfilGestor],
    );
    const [[u]] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [r.insertId]);
    return usuarioParaJSON(u);
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw new ErroNegocio(409, 'LOGIN_EM_USO', 'Já existe um usuário com esse login.');
    throw erro;
  }
}

export async function atualizarUsuario(id, dados, usuarioLogadoId) {
  const [[atual]] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
  if (!atual) throw new ErroNegocio(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.');
  const novo = {
    nome: dados.nome ?? atual.nome,
    login: dados.login ?? atual.login,
    senha: dados.senha || null,
    perfilAtendente: dados.perfilAtendente ?? !!atual.perfil_atendente,
    perfilGestor: dados.perfilGestor ?? !!atual.perfil_gestor,
    ativo: dados.ativo ?? !!atual.ativo,
  };
  validarUsuario(novo, false);
  if (!novo.perfilAtendente && !novo.perfilGestor) throw new ErroNegocio(400, 'SEM_PERFIL', 'Escolha ao menos um perfil.');

  if (id === usuarioLogadoId && (!novo.ativo || !novo.perfilGestor)) {
    throw new ErroNegocio(409, 'AUTO_BLOQUEIO', 'Você não pode desativar nem remover o perfil de gestor da sua própria conta.');
  }
  if (atual.perfil_gestor && (!novo.perfilGestor || !novo.ativo)) {
    const [[{ gestores }]] = await pool.query(
      'SELECT COUNT(*) AS gestores FROM usuarios WHERE perfil_gestor = 1 AND ativo = 1 AND id <> ?', [id]);
    if (Number(gestores) === 0) throw new ErroNegocio(409, 'ULTIMO_GESTOR', 'O sistema precisa de pelo menos um gestor ativo.');
  }
  if (!novo.ativo) {
    const [[{ ativos }]] = await pool.query(
      'SELECT COUNT(*) AS ativos FROM senhas WHERE usuario_id = ? AND estado IN (?)', [id, ESTADOS_ATIVOS]);
    if (Number(ativos) > 0) throw new ErroNegocio(409, 'ATENDIMENTO_EM_ANDAMENTO', 'O usuário tem um atendimento em andamento.');
  }

  const sets = ['nome = ?', 'login = ?', 'perfil_atendente = ?', 'perfil_gestor = ?', 'ativo = ?'];
  const valores = [String(novo.nome).trim(), novo.login, novo.perfilAtendente, novo.perfilGestor, novo.ativo];
  if (novo.senha) { sets.push('senha_hash = ?'); valores.push(await hashSenha(novo.senha)); }
  try {
    await pool.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, [...valores, id]);
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw new ErroNegocio(409, 'LOGIN_EM_USO', 'Já existe um usuário com esse login.');
    throw erro;
  }
  if (!novo.ativo) await pool.query('UPDATE guiches SET ocupante_id = NULL WHERE ocupante_id = ?', [id]);
  const [[u]] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
  return usuarioParaJSON(u);
}

function guicheParaJSON(g) {
  return {
    id: g.id,
    numero: g.numero,
    descricao: g.descricao,
    ativo: !!g.ativo,
    ocupante: g.ocupante_nome ?? null,
    ocupadoDesde: g.ocupado_desde,
  };
}

export async function listarGuiches({ somenteAtivos = false } = {}) {
  const [linhas] = await pool.query(
    `SELECT g.*, u.nome AS ocupante_nome FROM guiches g LEFT JOIN usuarios u ON u.id = g.ocupante_id
     ${somenteAtivos ? 'WHERE g.ativo = 1' : ''} ORDER BY g.numero`,
  );
  return linhas.map(guicheParaJSON);
}

export async function salvarGuiche(id, { numero, descricao, ativo }) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new ErroNegocio(400, 'NUMERO_INVALIDO', 'Número do guichê deve ser de 1 a 999.');
  try {
    if (id) {
      if (ativo === false) {
        const [[{ ativos }]] = await pool.query(
          'SELECT COUNT(*) AS ativos FROM senhas WHERE guiche_id = ? AND estado IN (?)', [id, ESTADOS_ATIVOS]);
        if (Number(ativos) > 0) throw new ErroNegocio(409, 'ATENDIMENTO_EM_ANDAMENTO', 'Há um atendimento em andamento neste guichê.');
      }
      await pool.query('UPDATE guiches SET numero = ?, descricao = ?, ativo = ? WHERE id = ?',
        [n, descricao || null, ativo !== false, id]);
      if (ativo === false) await pool.query('UPDATE guiches SET ocupante_id = NULL WHERE id = ?', [id]);
    } else {
      const [r] = await pool.query('INSERT INTO guiches (numero, descricao, ativo) VALUES (?, ?, ?)',
        [n, descricao || null, ativo !== false]);
      id = r.insertId;
    }
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') throw new ErroNegocio(409, 'NUMERO_EM_USO', `Já existe o guichê ${n}.`);
    throw erro;
  }
  const [[g]] = await pool.query(
    'SELECT g.*, u.nome AS ocupante_nome FROM guiches g LEFT JOIN usuarios u ON u.id = g.ocupante_id WHERE g.id = ?', [id]);
  return guicheParaJSON(g);
}
