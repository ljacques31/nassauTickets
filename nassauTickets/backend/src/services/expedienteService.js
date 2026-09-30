import { transacao } from '../config/db.js';
import { ESTADOS } from '../domain/estados.js';
import { agora, dataISO, paraSQL } from '../domain/relogio.js';
import { obterConfig, expedienteEncerrado } from './configService.js';
import { registrarEvento } from './eventoService.js';
import { publicarFila } from './painelService.js';

/**
 * Descarta as senhas que ficaram na fila ao fim do expediente.
 * Senhas já chamadas ou em atendimento NÃO são tocadas: o atendente conclui e encerra.
 * incluirHoje = true descarta também a fila do dia corrente (fechamento ou comando do gestor).
 */
export async function descartarFila({ incluirHoje, motivo = 'Fim do expediente' }) {
  const total = await transacao(async (conn) => {
    const momento = agora();
    const hoje = dataISO(momento);
    // Mesma ordem de bloqueio do chamarProxima (controle_fila primeiro) para evitar deadlock.
    await conn.query('SELECT id FROM controle_fila WHERE id = 1 FOR UPDATE');
    const [senhas] = await conn.query(
      `SELECT id, estado FROM senhas
        WHERE estado IN ('EMITIDA', 'AGUARDANDO')
          AND (data_emissao < ? ${incluirHoje ? 'OR data_emissao = ?' : ''})
        FOR UPDATE`,
      incluirHoje ? [hoje, hoje] : [hoje],
    );
    if (senhas.length === 0) return 0;
    const em = paraSQL(momento);
    for (const s of senhas) {
      await registrarEvento(conn, { senhaId: s.id, de: s.estado, para: ESTADOS.DESCARTADA, em, detalhe: motivo });
    }
    await conn.query(
      'UPDATE senhas SET estado = ?, encerrada_em = ? WHERE id IN (?)',
      [ESTADOS.DESCARTADA, em, senhas.map((s) => s.id)],
    );
    return senhas.length;
  });
  if (total > 0) publicarFila();
  return total;
}

/** Verificação periódica: filas de dias anteriores e, após o fechamento, a fila do dia. */
export async function verificarExpediente() {
  const cfg = await obterConfig();
  return descartarFila({ incluirHoje: expedienteEncerrado(cfg) });
}

let agendador = null;
export function iniciarAgendadorExpediente(intervaloMs = 30000) {
  if (agendador) return;
  const executar = async () => {
    try {
      const n = await verificarExpediente();
      if (n > 0) console.log(`[expediente] ${n} senha(s) descartada(s) ao fim do expediente.`);
    } catch (erro) {
      console.error('[expediente] falha ao verificar expediente:', erro.code || erro.message);
    }
  };
  executar();
  agendador = setInterval(executar, intervaloMs);
  agendador.unref();
}
