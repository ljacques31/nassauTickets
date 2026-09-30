/** Botão reutilizável. variante: primario | secundario | perigo | discreto */
export default function Botao({ variante = 'primario', grande = false, carregando = false, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`botao botao--${variante} ${grande ? 'botao--grande' : ''} ${className}`}
      disabled={carregando || props.disabled}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? 'Aguarde...' : children}
    </button>
  );
}
