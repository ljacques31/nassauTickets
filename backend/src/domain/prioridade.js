/**
 * Regra de prioridade do nassauTickets: [SP] -> [SE|SG] -> [SP] -> [SE|SG]
 *
 * O sistema guarda o tipo da última senha chamada (por qualquer guichê).
 * Se a última foi SP: a vez é de SE; se não houver SE, SG; se não houver nenhuma das duas, SP.
 * Se a última não foi SP (ou é a primeira do dia): a vez é de SP; se não houver, SE; depois SG.
 * Dentro de cada tipo vale a ordem de emissão (primeiro a chegar, primeiro a ser chamado).
 */
export const TIPOS = ['SP', 'SE', 'SG'];

export const NOMES_TIPO = {
  SP: 'Prioritária',
  SE: 'Retirada de exames',
  SG: 'Geral',
};

export function ordemDeBusca(ultimoTipo) {
  return ultimoTipo === 'SP' ? ['SE', 'SG', 'SP'] : ['SP', 'SE', 'SG'];
}

/** contagens: { SP: n, SE: n, SG: n }. Retorna o tipo a chamar ou null se todas as filas estão vazias. */
export function escolherProximoTipo(ultimoTipo, contagens) {
  return ordemDeBusca(ultimoTipo).find((tipo) => (contagens[tipo] || 0) > 0) ?? null;
}

export function tipoValido(tipo) {
  return TIPOS.includes(tipo);
}
