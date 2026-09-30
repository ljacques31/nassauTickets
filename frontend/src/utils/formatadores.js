export const NOMES_TIPO = { SP: 'Prioritária', SE: 'Retirada de exames', SG: 'Geral' };

export const ROTULO_ESTADO = {
  EMITIDA: 'Emitida',
  AGUARDANDO: 'Aguardando',
  CHAMADA: 'Chamada',
  CHAMADA_NOVAMENTE: 'Chamada novamente',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
  NAO_COMPARECEU: 'Não compareceu',
  DESCARTADA: 'Descartada',
};

/** '2026-09-29 14:03:11.123' -> '29/09/2026 14:03:11' */
export function dataHora(texto) {
  if (!texto) return '';
  const [d, h = ''] = texto.split(' ');
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a} ${h.slice(0, 8)}`.trim();
}

export function hora(texto) {
  return texto ? texto.split(' ')[1]?.slice(0, 5) ?? '' : '';
}

/** 352 -> '5 min 52 s' */
export function duracao(segundos) {
  if (segundos === null || segundos === undefined) return 'sem dados';
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export function percentual(valor) {
  return `${(valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function numero(n) {
  return Number(n || 0).toLocaleString('pt-BR');
}

/** '260929-SP004' -> { data: '260929', tipo: 'SP', seq: '004' } */
export function partesCodigo(codigo = '') {
  const [data, resto = ''] = codigo.split('-');
  return { data, tipo: resto.slice(0, 2), seq: resto.slice(2) };
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
