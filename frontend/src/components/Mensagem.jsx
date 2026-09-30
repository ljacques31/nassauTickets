/** Mensagem de retorno ao usuário. tipo: erro | sucesso | info */
export default function Mensagem({ tipo = 'info', children, aoFechar }) {
  if (!children) return null;
  return (
    <div className={`mensagem mensagem--${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <span>{children}</span>
      {aoFechar && (
        <button type="button" className="mensagem__fechar" onClick={aoFechar} aria-label="Fechar mensagem">×</button>
      )}
    </div>
  );
}
