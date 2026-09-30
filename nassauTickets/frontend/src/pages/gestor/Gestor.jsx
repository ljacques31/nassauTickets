import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Botao from '../../components/Botao.jsx';
import Marca from '../../components/Marca.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

const ABAS = [
  ['relatorios', 'Relatórios'],
  ['desempenho', 'Desempenho'],
  ['usuarios', 'Atendentes'],
  ['guiches', 'Guichês'],
  ['expediente', 'Expediente e simulação'],
];

export default function Gestor() {
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();

  async function encerrar() {
    await sair();
    navegar('/login', { replace: true });
  }

  return (
    <div className="gestor">
      <header className="barra-topo">
        <Marca subtitulo="Gestão" />
        <nav className="barra-topo__acoes" aria-label="Sessão">
          <span className="barra-topo__usuario">{usuario.nome}</span>
          {usuario.guicheId && <Link className="botao botao--discreto" to="/atendente">Voltar ao guichê {usuario.guicheNumero}</Link>}
          <Botao variante="discreto" onClick={encerrar}>Sair</Botao>
        </nav>
      </header>
      <nav className="abas" aria-label="Áreas da gestão">
        {ABAS.map(([para, rotulo]) => (
          <NavLink key={para} to={para} className={({ isActive }) => `abas__item ${isActive ? 'ativo' : ''}`}>
            {rotulo}
          </NavLink>
        ))}
      </nav>
      <main className="gestor__conteudo">
        <Outlet />
      </main>
    </div>
  );
}
