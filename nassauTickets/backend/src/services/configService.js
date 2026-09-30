import { pool } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { agora, minutosDe, minutosDoDia } from '../domain/relogio.js';

export const CONFIG_PADRAO = {
  hora_abertura: '07:00',
  hora_fechamento: '17:00',
  modo_demonstracao: '0', // 1 = ignora o horário do expediente (apresentações e testes)
};

let cache = null;
let cacheEm = 0;

export async function obterConfig() {
  if (cache && Date.now() - cacheEm < 5000) return cache;
  const [linhas] = await pool.query('SELECT chave, valor FROM configuracoes');
  cache = { ...CONFIG_PADRAO, ...Object.fromEntries(linhas.map((l) => [l.chave, l.valor])) };
  cacheEm = Date.now();
  return cache;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function salvarConfig(parcial) {
  const atual = await obterConfig();
  const nova = { ...atual };
  if (parcial.hora_abertura !== undefined) nova.hora_abertura = String(parcial.hora_abertura);
  if (parcial.hora_fechamento !== undefined) nova.hora_fechamento = String(parcial.hora_fechamento);
  if (parcial.modo_demonstracao !== undefined) nova.modo_demonstracao = parcial.modo_demonstracao ? '1' : '0';

  if (!HORA.test(nova.hora_abertura) || !HORA.test(nova.hora_fechamento)) {
    throw new ErroNegocio(400, 'HORARIO_INVALIDO', 'Use o formato HH:mm para os horários.');
  }
  if (minutosDe(nova.hora_abertura) >= minutosDe(nova.hora_fechamento)) {
    throw new ErroNegocio(400, 'HORARIO_INVALIDO', 'A abertura precisa ser antes do fechamento.');
  }
  for (const [chave, valor] of Object.entries(nova)) {
    await pool.query(
      'INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
      [chave, valor],
    );
  }
  cache = null;
  return obterConfig();
}

export function emDemonstracao(cfg) {
  return cfg.modo_demonstracao === '1';
}

/** Emissão de senhas só é permitida dentro do expediente (ou em modo demonstração). */
export function expedienteAberto(cfg, momento = agora()) {
  if (emDemonstracao(cfg)) return true;
  const m = minutosDoDia(momento);
  return m >= minutosDe(cfg.hora_abertura) && m < minutosDe(cfg.hora_fechamento);
}

/** Verdadeiro depois do horário de fechamento: hora de descartar a fila do dia. */
export function expedienteEncerrado(cfg, momento = agora()) {
  if (emDemonstracao(cfg)) return false;
  return minutosDoDia(momento) >= minutosDe(cfg.hora_fechamento);
}

export function limparCacheConfig() {
  cache = null;
}
