import { useEffect, useState } from 'react';
import AvisoConexao from '../components/AvisoConexao.jsx';
import Canhoto from '../components/Canhoto.jsx';
import Marca from '../components/Marca.jsx';
import { useRelogio } from '../hooks/useRelogio.js';
import { useTempoReal } from '../hooks/useTempoReal.js';
import { api } from '../services/api.js';
import { anunciar, audioDisponivel, liberarAudio } from '../services/voz.js';
import { partesCodigo } from '../utils/formatadores.js';

/**
 * Painel da sala de espera. Mostra as 5 últimas senhas chamadas e anuncia cada chamada por voz.
 * A próxima senha nunca aparece aqui: ela só é definida quando o atendente clica em "Chamar próxima".
 * Se o servidor cair, o painel mantém a última lista conhecida e se reconecta sozinho.
 */
export default function Painel() {
  const [ultimas, setUltimas] = useState([]);
  const [somAtivo, setSomAtivo] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const agora = useRelogio();

  async function carregar() {
    try {
      const dados = await api.painel();
      setUltimas(dados.ultimas);
      setCarregado(true);
    } catch {
      /* mantém a lista atual na tela */
    }
  }

  const { conexao, bancoOk } = useTempoReal({
    chamada: (dados) => {
      setUltimas(dados.ultimas);
      setCarregado(true);
      if (somAtivo) anunciar(dados.chamada);
    },
    aoReconectar: carregar,
  });

  useEffect(() => { carregar(); }, []);

  function ativarSom() {
    if (liberarAudio()) setSomAtivo(true);
  }

  const [atual, ...anteriores] = ultimas;

  return (
    <main className="painel">
      <header className="painel__topo">
        <Marca subtitulo="Laboratório de Análises Clínicas" clara />
        <time className="painel__relogio" dateTime={agora.toISOString()}>
          {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>

      <section className="painel__atual" aria-live="assertive" aria-atomic="true">
        {atual ? (
          <div key={`${atual.codigo}-${atual.ultimaChamada}-${atual.chamadaEm}`} className="painel__chamada">
            <Canhoto
              codigo={atual.codigo}
              tipo={atual.tipo}
              tamanho="painel"
              destaque={atual.ultimaChamada ? 'Última chamada' : null}
            >
              <span className="canhoto__guiche">
                Guichê <strong>{atual.guiche}</strong>
              </span>
            </Canhoto>
          </div>
        ) : (
          <p className="painel__vazio">{carregado ? 'Aguardando a primeira chamada do dia.' : 'Carregando chamadas...'}</p>
        )}
      </section>

      <aside className="painel__anteriores" aria-label="Chamadas anteriores">
        <h2 className="painel__subtitulo">Chamadas anteriores</h2>
        <ol className="painel__lista">
          {anteriores.map((c) => {
            const { seq } = partesCodigo(c.codigo);
            return (
              <li key={c.codigo} className={`painel__item painel__item--${c.tipo}`}>
                <span className="painel__item-codigo">{c.tipo} {seq}</span>
                <span className="painel__item-guiche">Guichê {c.guiche}</span>
              </li>
            );
          })}
          {Array.from({ length: Math.max(0, 4 - anteriores.length) }, (_, i) => (
            <li key={`vazio-${i}`} className="painel__item painel__item--vazio" aria-hidden="true" />
          ))}
        </ol>
      </aside>

      <footer className="painel__rodape">
        <AvisoConexao conexao={conexao} bancoOk={bancoOk} />
        {!somAtivo && audioDisponivel() && (
          <button type="button" className="painel__som" onClick={ativarSom}>
            Ativar som das chamadas
          </button>
        )}
      </footer>
    </main>
  );
}
