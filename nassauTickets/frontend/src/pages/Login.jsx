import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Botao from '../components/Botao.jsx';
import Campo from '../components/Campo.jsx';
import Marca from '../components/Marca.jsx';
import Mensagem from '../components/Mensagem.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api } from '../services/api.js';

export default function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [form, setForm] = useState({ login: '', senha: '', guicheId: '' });
  const [guiches, setGuiches] = useState([]);
  const [erro, setErro] = useState(local.state?.precisaGuiche ? 'Para atender, entre escolhendo um guichê.' : '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.guiches()
      .then(setGuiches)
      .catch(() => setErro('Não foi possível carregar os guichês. Verifique a conexão com o servidor.'));
  }, []);

  const alterar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const usuario = await entrar({
        login: form.login.trim(),
        senha: form.senha,
        guicheId: form.guicheId ? Number(form.guicheId) : undefined,
      });
      navegar(usuario.guicheId ? '/atendente' : '/gestor', { replace: true });
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <form className="login__cartao" onSubmit={enviar} noValidate>
        <Marca subtitulo="Acesso do atendente" />
        <Mensagem tipo="erro" aoFechar={erro ? () => setErro('') : undefined}>{erro}</Mensagem>
        <Campo rotulo="Usuário">
          {(id) => <input id={id} name="login" autoComplete="username" value={form.login} onChange={alterar} required autoFocus />}
        </Campo>
        <Campo rotulo="Senha">
          {(id) => <input id={id} name="senha" type="password" autoComplete="current-password" value={form.senha} onChange={alterar} required />}
        </Campo>
        <Campo rotulo="Guichê" ajuda="Quem só vai acessar relatórios e cadastros pode entrar sem guichê.">
          {(id) => (
            <select id={id} name="guicheId" value={form.guicheId} onChange={alterar}>
              <option value="">Sem guichê (somente gestão)</option>
              {guiches.map((g) => (
                <option key={g.id} value={g.id}>
                  Guichê {g.numero}{g.descricao ? `, ${g.descricao}` : ''}{g.ocupado ? ' (em uso)' : ''}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Botao type="submit" grande carregando={enviando} disabled={!form.login || !form.senha}>Entrar</Botao>
        <Link to="/" className="link-discreto">Voltar às telas do sistema</Link>
      </form>
    </main>
  );
}
