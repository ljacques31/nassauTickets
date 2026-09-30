import { ErroNegocio } from './erros.js';

export const ESTADOS = {
  EMITIDA: 'EMITIDA',
  AGUARDANDO: 'AGUARDANDO',
  CHAMADA: 'CHAMADA',
  CHAMADA_NOVAMENTE: 'CHAMADA_NOVAMENTE',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  ATENDIDA: 'ATENDIDA',
  NAO_COMPARECEU: 'NAO_COMPARECEU',
  DESCARTADA: 'DESCARTADA',
};

const E = ESTADOS;

/** Transições permitidas. Qualquer outra é recusada pelo backend. */
export const TRANSICOES = {
  [E.EMITIDA]: [E.AGUARDANDO, E.DESCARTADA],
  [E.AGUARDANDO]: [E.CHAMADA, E.DESCARTADA],
  [E.CHAMADA]: [E.CHAMADA_NOVAMENTE, E.EM_ATENDIMENTO],
  [E.CHAMADA_NOVAMENTE]: [E.EM_ATENDIMENTO, E.NAO_COMPARECEU],
  [E.EM_ATENDIMENTO]: [E.ATENDIDA],
  [E.ATENDIDA]: [],
  [E.NAO_COMPARECEU]: [],
  [E.DESCARTADA]: [],
};

/** Estados em que a senha está nas mãos de um atendente. */
export const ESTADOS_ATIVOS = [E.CHAMADA, E.CHAMADA_NOVAMENTE, E.EM_ATENDIMENTO];

/** Estados finais: a senha não muda mais. */
export const ESTADOS_FINAIS = [E.ATENDIDA, E.NAO_COMPARECEU, E.DESCARTADA];

export function podeTransitar(de, para) {
  return (TRANSICOES[de] || []).includes(para);
}

export function exigirTransicao(de, para) {
  if (!podeTransitar(de, para)) {
    throw new ErroNegocio(409, 'TRANSICAO_INVALIDA', `A senha está em ${de} e não pode passar para ${para}.`, { de, para });
  }
}
