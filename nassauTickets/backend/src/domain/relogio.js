// Funções de data e hora no fuso do laboratório (process.env.TZ).

const p2 = (n) => String(n).padStart(2, '0');
const p3 = (n) => String(n).padStart(3, '0');

export const agora = () => new Date();

/** 'YYYY-MM-DD' */
export function dataISO(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** 'YYYY-MM-DD HH:mm:ss.SSS', formato aceito por colunas DATETIME(3) */
export function paraSQL(d) {
  return `${dataISO(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p3(d.getMilliseconds())}`;
}

/** 'YYMMDD', prefixo do código da senha */
export function prefixoData(d) {
  return `${String(d.getFullYear()).slice(-2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
}

/** Converte 'HH:mm' em minutos desde a meia noite. */
export function minutosDe(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutosDoDia(d) {
  return d.getHours() * 60 + d.getMinutes();
}

/** Converte 'YYYY-MM-DD' em Date local à meia noite. */
export function dataDeISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
