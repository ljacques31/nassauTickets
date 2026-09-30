/**
 * Tabela genérica. colunas: [{ titulo, campo, render?, alinhar? }]
 * Renderiza qualquer lista de objetos, com mensagem própria quando vazia.
 */
export default function Tabela({ colunas, linhas, chave, vazio = 'Nenhum registro no período.', legenda }) {
  return (
    <div className="tabela-rolagem" tabIndex={0} role="region" aria-label={legenda || 'Tabela'}>
      <table className="tabela">
        {legenda && <caption className="sr-only">{legenda}</caption>}
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.titulo} scope="col" className={c.alinhar === 'direita' ? 'direita' : ''}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr><td colSpan={colunas.length} className="tabela__vazia">{vazio}</td></tr>
          ) : (
            linhas.map((linha, i) => (
              <tr key={chave ? linha[chave] : i}>
                {colunas.map((c) => (
                  <td key={c.titulo} className={c.alinhar === 'direita' ? 'direita' : ''}>
                    {c.render ? c.render(linha) : linha[c.campo]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
