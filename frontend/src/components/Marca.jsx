/** Logotipo: um canhoto de senha com a gota de coleta do laboratório. */
export default function Marca({ subtitulo, clara = false }) {
  return (
    <div className={`marca ${clara ? 'marca--clara' : ''}`}>
      <svg className="marca__icone" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="var(--petroleo)" />
        <path d="M12 18h40v9a5 5 0 0 0 0 10v9H12v-9a5 5 0 0 0 0-10z" fill="var(--papel)" />
        <path d="M32 22.5c-4.6 6.3-7.2 9.6-7.2 13a7.2 7.2 0 0 0 14.4 0c0-3.4-2.6-6.7-7.2-13z" fill="var(--sp)" />
      </svg>
      <div>
        <span className="marca__nome">nassau<strong>Tickets</strong></span>
        {subtitulo && <span className="marca__sub">{subtitulo}</span>}
      </div>
    </div>
  );
}
