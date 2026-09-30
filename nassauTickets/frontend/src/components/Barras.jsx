/** Gráfico de barras horizontais simples, sem biblioteca externa. */
export default function Barras({ titulo, itens, formatar = (v) => v, cor }) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor || 0));
  return (
    <figure className="barras">
      <figcaption className="barras__titulo">{titulo}</figcaption>
      {itens.length === 0 && <p className="texto-suave">Sem dados no período.</p>}
      <ul>
        {itens.map((item) => (
          <li key={item.rotulo} className="barras__linha">
            <span className="barras__rotulo">{item.rotulo}</span>
            <span className="barras__trilho">
              <span className="barras__valor-barra"
                style={{ width: `${((item.valor || 0) / maximo) * 100}%`, background: item.cor || cor || 'var(--petroleo)' }} />
            </span>
            <span className="barras__numero">{formatar(item.valor)}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
