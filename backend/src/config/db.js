import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 20,
  dateStrings: true,       // datas voltam como texto local, sem conversão de fuso
  connectTimeout: 5000,
});

const ERROS_REPETIVEIS = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

/**
 * Executa fn dentro de uma transação. Em deadlock ou espera de bloqueio esgotada,
 * refaz a transação inteira (até 3 tentativas), o que é seguro porque nada foi confirmado.
 */
export async function transacao(fn, tentativas = 3) {
  for (let tentativa = 1; ; tentativa++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const resultado = await fn(conn);
      await conn.commit();
      return resultado;
    } catch (erro) {
      try { await conn.rollback(); } catch { /* conexão pode ter caído */ }
      if (ERROS_REPETIVEIS.has(erro.code) && tentativa < tentativas) continue;
      throw erro;
    } finally {
      conn.release();
    }
  }
}

export async function bancoDisponivel() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
