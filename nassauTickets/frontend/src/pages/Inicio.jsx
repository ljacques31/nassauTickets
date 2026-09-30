import { Link } from 'react-router-dom';
import Marca from '../components/Marca.jsx';

const TELAS = [
  { para: '/totem', titulo: 'Totem', texto: 'Onde o cliente retira a senha, sem se identificar.' },
  { para: '/painel', titulo: 'Painel de chamadas', texto: 'Tela da sala de espera, com as 5 últimas chamadas e aviso por voz.' },
  { para: '/login', titulo: 'Atendimento no guichê', texto: 'Entrada do atendente: chamar, atender e finalizar senhas.' },
  { para: '/gestor', titulo: 'Gestão', texto: 'Relatórios diário e mensal, auditoria, desempenho e cadastros.' },
];

export default function Inicio() {
  return (
    <main className="inicio">
      <Marca subtitulo="Controle de atendimento do laboratório de análises clínicas" />
      <p className="inicio__intro">
        Cada tela abaixo foi feita para um dispositivo diferente da recepção. Abra cada uma em uma janela ou aparelho.
      </p>
      <nav aria-label="Telas do sistema">
        <ul className="inicio__lista">
          {TELAS.map((t) => (
            <li key={t.para}>
              <Link to={t.para} className="inicio__item">
                <span className="inicio__titulo">{t.titulo}</span>
                <span className="inicio__texto">{t.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
