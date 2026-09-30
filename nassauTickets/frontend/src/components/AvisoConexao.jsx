/** Faixa de estado da conexão com o servidor e o banco de dados. */
export default function AvisoConexao({ conexao, bancoOk }) {
  if (conexao === 'online' && bancoOk) return null;
  let texto = 'Conectando ao servidor...';
  if (conexao === 'offline') texto = 'Sem conexão com o servidor. Tentando reconectar automaticamente.';
  else if (!bancoOk) texto = 'O banco de dados não está respondendo. As informações exibidas podem estar desatualizadas.';
  return (
    <div className={`aviso-conexao ${conexao === 'conectando' ? 'aviso-conexao--neutro' : ''}`} role="status" aria-live="polite">
      <span className="aviso-conexao__ponto" aria-hidden="true" />
      {texto}
    </div>
  );
}
