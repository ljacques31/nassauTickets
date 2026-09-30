import { pool, transacao } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { ESTADOS } from '../domain/estados.js';
import { formatarCodigo } from '../domain/numeracao.js';
import { tipoValido, NOMES_TIPO } from '../domain/prioridade.js';
import { agora, dataISO, paraSQL } from '../domain/relogio.js';
import { obterConfig, expedienteAberto } from './configService.js';
import { registrarEvento } from './eventoService.js';
import { publicarFila } from './painelService.js';

function paraJSON(s) {
  return {
    id: s.id,
    codigo: s.codigo,
    tipo: s.tipo,
    tipoNome: NOMES_TIPO[s.tipo],
    estado: s.estado,
    emitidaEm: s.emitida_em,
  };
}

async function buscarPorChave(chave) {
  const [[s]] = await pool.query('SELECT * FROM senhas WHERE idempotency_key = ?', [chave]);
  return s ? paraJSON(s) : null;
}

/**
 * Emite uma senha (Agente Cliente pelo totem).
 * A sequência diária é incrementada de forma atômica no MySQL (LAST_INSERT_ID(expr)),
 * de modo que dois totens simultâneos nunca recebem o mesmo número.
 * A chave de idempotência evita senha duplicada quando o totem reenvia após falha de rede.
 */
export async function emitirSenha({ tipo, idempotencyKey = null, momento = agora(), ignorarExpediente = false, simulada = false }) {
  if (!tipoValido(tipo)) {
    throw new ErroNegocio(400, 'TIPO_INVALIDO', 'Tipo de senha inválido. Use SP, SG ou SE.');
  }
  if (!ignorarExpediente) {
    const cfg = await obterConfig();
    if (!expedienteAberto(cfg, momento)) {
      throw new ErroNegocio(403, 'FORA_DO_EXPEDIENTE',
        `A emissão de senhas funciona das ${cfg.hora_abertura} às ${cfg.hora_fechamento}.`);
    }
  }
  if (idempotencyKey) {
    const existente = await buscarPorChave(idempotencyKey);
    if (existente) return { senha: existente, repetida: true };
  }

  try {
    const senha = await transacao(async (conn) => {
      const data = dataISO(momento);
      await conn.query(
        `INSERT INTO sequencias_diarias (data, tipo, ultimo) VALUES (?, ?, LAST_INSERT_ID(1))
         ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
        [data, tipo],
      );
      const [[{ seq }]] = await conn.query('SELECT LAST_INSERT_ID() AS seq');
      const sequencia = Number(seq);
      const codigo = formatarCodigo(momento, tipo, sequencia); // lança acima de 999 e desfaz o incremento
      const em = paraSQL(momento);

      const [r] = await conn.query(
        `INSERT INTO senhas (codigo, tipo, sequencia, data_emissao, emitida_em, estado, idempotency_key, simulada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [codigo, tipo, sequencia, data, em, ESTADOS.EMITIDA, idempotencyKey, simulada ? 1 : 0],
      );
      const senhaId = r.insertId;
      await registrarEvento(conn, { senhaId, para: ESTADOS.EMITIDA, em, detalhe: 'Emitida no totem' });

      // EMITIDA -> AGUARDANDO: confirmada a gravação, a senha entra na fila.
      await conn.query('UPDATE senhas SET estado = ? WHERE id = ?', [ESTADOS.AGUARDANDO, senhaId]);
      await registrarEvento(conn, { senhaId, de: ESTADOS.EMITIDA, para: ESTADOS.AGUARDANDO, em });

      return { id: senhaId, codigo, tipo, tipoNome: NOMES_TIPO[tipo], estado: ESTADOS.AGUARDANDO, emitidaEm: em };
    });
    publicarFila();
    return { senha, repetida: false };
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY' && idempotencyKey) {
      const existente = await buscarPorChave(idempotencyKey);
      if (existente) return { senha: existente, repetida: true };
    }
    throw erro;
  }
}
