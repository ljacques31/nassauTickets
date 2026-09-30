import { prefixoData } from './relogio.js';
import { ErroNegocio } from './erros.js';

export const SEQUENCIA_MAXIMA = 999;

/**
 * Monta o código no padrão YYMMDD-PPSQ.
 * Ex.: 29/09/2026, tipo SP, sequência 1  =>  260929-SP001
 */
export function formatarCodigo(data, tipo, sequencia) {
  if (!Number.isInteger(sequencia) || sequencia < 1) {
    throw new Error('Sequência inválida');
  }
  if (sequencia > SEQUENCIA_MAXIMA) {
    throw new ErroNegocio(409, 'LIMITE_DIARIO', `Limite de ${SEQUENCIA_MAXIMA} senhas ${tipo} por dia atingido.`);
  }
  return `${prefixoData(data)}-${tipo}${String(sequencia).padStart(3, '0')}`;
}

const PADRAO = /^(\d{2})(\d{2})(\d{2})-(SP|SG|SE)(\d{3})$/;

export function validarCodigo(codigo) {
  return PADRAO.test(codigo);
}
