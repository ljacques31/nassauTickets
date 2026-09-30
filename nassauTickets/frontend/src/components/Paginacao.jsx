export default function Paginacao({ pagina, tamanho, total, aoMudar }) {
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  if (total <= tamanho) return <p className="paginacao">{total} registro(s)</p>;
  return (
    <nav className="paginacao" aria-label="Paginação">
      <button type="button" className="botao botao--discreto" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        Anterior
      </button>
      <span>Página {pagina} de {paginas} ({total} registros)</span>
      <button type="button" className="botao botao--discreto" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
        Próxima
      </button>
    </nav>
  );
}
