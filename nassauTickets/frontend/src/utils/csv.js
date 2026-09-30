/** Gera e baixa um CSV (separador ponto e vírgula, compatível com o Excel em português). */
export function baixarCsv(nomeArquivo, colunas, linhas) {
  const escapar = (v) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const conteudo = [
    colunas.map((c) => escapar(c.titulo)).join(';'),
    ...linhas.map((l) => colunas.map((c) => escapar(c.csv ? c.csv(l) : l[c.campo])).join(';')),
  ].join('\r\n');
  const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
