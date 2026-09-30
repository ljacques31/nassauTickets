export default function Indicador({ rotulo, valor, detalhe, tipo }) {
  return (
    <div className={`indicador ${tipo ? `indicador--${tipo}` : ''}`}>
      <span className="indicador__rotulo">{rotulo}</span>
      <span className="indicador__valor">{valor}</span>
      {detalhe && <span className="indicador__detalhe">{detalhe}</span>}
    </div>
  );
}
