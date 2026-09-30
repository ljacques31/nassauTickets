import { pool, bancoDisponivel } from '../config/db.js';
import { agora, dataISO, paraSQL } from '../domain/relogio.js';

/**
 * Canal de tempo real (Server Sent Events).
 * O painel, o totem e as telas de atendente assinam /api/eventos e recebem:
 *   chamada  -> nova chamada ou chamada novamente (com as 5 últimas)
 *   fila     -> quantidade de senhas aguardando por tipo (sem revelar qual é a próxima)
 *   status   -> batimento a cada 10 s informando se o banco está disponível
 */
const clientes = new Set();

export function registrarCliente(res) {
  clientes.add(res);
  res.on('close', () => clientes.delete(res));
}

export function publicar(evento, dados) {
  const pacote = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const res of clientes) {
    try { res.write(pacote); } catch { clientes.delete(res); }
  }
}

export function totalClientes() {
  return clientes.size;
}

/** As 5 últimas senhas chamadas hoje, sem repetição. A mais recente vem primeiro. */
export async function ultimasChamadas(limite = 5) {
  const [linhas] = await pool.query(
    `SELECT e.id, e.estado_novo, e.ocorrido_em, s.codigo, s.tipo, g.numero AS guiche
       FROM senha_eventos e
       JOIN senhas s  ON s.id = e.senha_id
       JOIN guiches g ON g.id = e.guiche_id
      WHERE e.estado_novo IN ('CHAMADA', 'CHAMADA_NOVAMENTE')
        AND s.data_emissao = ?
      ORDER BY e.id DESC
      LIMIT 40`,
    [dataISO(agora())],
  );
  const vistas = new Set();
  const resultado = [];
  for (const l of linhas) {
    if (vistas.has(l.codigo)) continue;
    vistas.add(l.codigo);
    resultado.push({
      codigo: l.codigo,
      tipo: l.tipo,
      guiche: l.guiche,
      ultimaChamada: l.estado_novo === 'CHAMADA_NOVAMENTE',
      chamadaEm: l.ocorrido_em,
    });
    if (resultado.length === limite) break;
  }
  return resultado;
}

export async function contagemFila(conn = pool) {
  const [linhas] = await conn.query(
    `SELECT tipo, COUNT(*) AS total FROM senhas WHERE estado = 'AGUARDANDO' GROUP BY tipo`,
  );
  const contagem = { SP: 0, SE: 0, SG: 0 };
  for (const l of linhas) contagem[l.tipo] = Number(l.total);
  return contagem;
}

/** Publica a fila atualizada sem deixar uma falha de publicação derrubar a operação principal. */
export async function publicarFila() {
  try {
    publicar('fila', await contagemFila());
  } catch { /* o batimento seguinte informa a indisponibilidade */ }
}

let batimento = null;
export function iniciarBatimento() {
  if (batimento) return;
  batimento = setInterval(async () => {
    publicar('status', { db: await bancoDisponivel(), servidorEm: paraSQL(agora()) });
  }, 10000);
  batimento.unref();
}
