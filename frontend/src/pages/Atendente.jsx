import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvisoConexao from '../components/AvisoConexao.jsx';
import Botao from '../components/Botao.jsx';
import Canhoto from '../components/Canhoto.jsx';
import Marca from '../components/Marca.jsx';
import Mensagem from '../components/Mensagem.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useRelogio } from '../hooks/useRelogio.js';
import { useRequisicao } from '../hooks/useRequisicao.js';
import { useTempoReal } from '../hooks/useTempoReal.js';
import { api } from '../services/api.js';
import { NOMES_TIPO, ROTULO_ESTADO, duracao, hora } from '../utils/formatadores.js';

/** Segundos entre um instante absoluto enviado pelo servidor e agora. */
const segundosDesde = (epoch, agora) => (epoch ? Math.max(0, (agora.getTime() - epoch) / 1000) : 0);

/** Diferença em segundos entre dois horários do servidor ('YYYY-MM-DD HH:mm:ss.SSS'). */
const intervalo = (de, ate) => (new Date(ate.replace(' ', 'T')) - new Date(de.replace(' ', 'T'))) / 1000;

export default function Atendente() {
  const { usuario, sair } = useAuth();
  const requisitar = useRequisicao();
  const navegar = useNavigate();
  const agora = useRelogio();

  const [senha, setSenha] = useState(null);
  const [fila, setFila] = useState({ SP: 0, SE: 0, SG: 0 });
  const [historico, setHistorico] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  async function carregar() {
    try {
      const [atual, contagem, feitos] = await Promise.all([
        requisitar(api.atual), api.fila(), requisitar(api.historico),
      ]);
      setSenha(atual.senha);
      setFila(contagem);
      setHistorico(feitos);
    } catch (erro) {
      tratarErro(erro);
    }
  }

  const { conexao, bancoOk } = useTempoReal({ fila: setFila, aoReconectar: carregar });

  useEffect(() => { carregar(); }, []);

  function tratarErro(erro) {
    if (['GUICHE_LIBERADO', 'SEM_GUICHE'].includes(erro.codigo)) {
      sair();
      navegar('/login', { replace: true, state: { precisaGuiche: true } });
      return;
    }
    if (erro.codigo === 'SENHA_ATIVA' && erro.dados) setSenha(erro.dados);
    setMensagem({ tipo: 'erro', texto: erro.message });
  }

  /** Um clique por vez: o botão fica bloqueado até o servidor responder (evita cliques duplos). */
  async function executar(fn, aoConcluir) {
    setOcupado(true);
    setMensagem(null);
    try {
      const resposta = await requisitar(fn);
      aoConcluir(resposta);
    } catch (erro) {
      tratarErro(erro);
    } finally {
      setOcupado(false);
    }
  }

  const chamarProxima = () => executar(api.chamarProxima, (r) => {
    setSenha(r.senha);
    if (!r.senha) setMensagem({ tipo: 'info', texto: 'Não há senhas aguardando no momento.' });
  });

  const agir = (acao, encerra = false) => executar((t) => api.acaoSenha(t, senha.id, acao), (r) => {
    if (encerra) {
      setSenha(null);
      setHistorico((h) => [r.senha, ...h].slice(0, 20));
      setMensagem({ tipo: 'sucesso', texto: `Senha ${r.senha.codigo} ${ROTULO_ESTADO[r.senha.estado].toLowerCase()}.` });
    } else {
      setSenha(r.senha);
    }
  });

  async function encerrarSessao() {
    if (senha && !window.confirm('Há uma senha em andamento. Sair mesmo assim? Ela continuará vinculada a você.')) return;
    await sair();
    navegar('/login', { replace: true });
  }

  const totalFila = fila.SP + fila.SE + fila.SG;

  return (
    <div className="atendente">
      <header className="barra-topo">
        <Marca subtitulo={`Guichê ${usuario.guicheNumero}`} />
        <nav className="barra-topo__acoes" aria-label="Sessão">
          <span className="barra-topo__usuario">{usuario.nome}</span>
          {usuario.perfis.gestor && <Link className="botao botao--discreto" to="/gestor">Gestão</Link>}
          <Botao variante="discreto" onClick={encerrarSessao}>Sair</Botao>
        </nav>
      </header>
      <AvisoConexao conexao={conexao} bancoOk={bancoOk} />

      <main className="atendente__conteudo">
        <section className="atendente__principal" aria-labelledby="titulo-atual">
          <h1 id="titulo-atual" className="sr-only">Atendimento atual</h1>
          <Mensagem tipo={mensagem?.tipo} aoFechar={() => setMensagem(null)}>{mensagem?.texto}</Mensagem>

          {!senha && (
            <div className="atendente__livre">
              <p className="atendente__estado">Guichê livre</p>
              <Botao grande onClick={chamarProxima} carregando={ocupado} disabled={totalFila === 0 && conexao === 'online'}>
                Chamar próxima senha
              </Botao>
              <p className="texto-suave">
                {totalFila === 0 ? 'Nenhuma senha aguardando.' : `${totalFila} senha(s) aguardando.`} O sistema escolhe a próxima
                pela regra de prioridade.
              </p>
            </div>
          )}

          {senha && (
            <div className="atendente__senha">
              <Canhoto
                codigo={senha.codigo}
                tipo={senha.tipo}
                tamanho="grande"
                destaque={senha.estado === 'CHAMADA_NOVAMENTE' ? 'Última chamada feita' : null}
              >
                <span className={`selo selo--${senha.estado}`}>{ROTULO_ESTADO[senha.estado]}</span>
                {senha.estado === 'EM_ATENDIMENTO' ? (
                  <span className="canhoto__meta">
                    Em atendimento há {duracao(segundosDesde(senha.inicioAtendimentoEpoch, agora))}
                  </span>
                ) : (
                  <span className="canhoto__meta">
                    Chamada às {hora(senha.segundaChamadaEm || senha.primeiraChamadaEm)}. Aguardou{' '}
                    {duracao(intervalo(senha.emitidaEm, senha.primeiraChamadaEm))} na fila.
                  </span>
                )}
              </Canhoto>

              <div className="atendente__acoes">
                {(senha.estado === 'CHAMADA' || senha.estado === 'CHAMADA_NOVAMENTE') && (
                  <Botao grande onClick={() => agir('iniciar')} carregando={ocupado}>Cliente chegou: iniciar atendimento</Botao>
                )}
                {senha.estado === 'CHAMADA' && (
                  <Botao variante="secundario" onClick={() => agir('chamar-novamente')} disabled={ocupado}>
                    Chamar novamente (última chamada)
                  </Botao>
                )}
                {senha.estado === 'CHAMADA_NOVAMENTE' && (
                  <Botao variante="perigo" onClick={() => agir('nao-compareceu', true)} disabled={ocupado}>
                    Registrar não comparecimento
                  </Botao>
                )}
                {senha.estado === 'EM_ATENDIMENTO' && (
                  <Botao grande onClick={() => agir('finalizar', true)} carregando={ocupado}>Finalizar atendimento</Botao>
                )}
              </div>
              {senha.estado === 'CHAMADA' && (
                <p className="texto-suave">Se o cliente não aparecer, chame novamente. Após a segunda chamada, registre o não comparecimento.</p>
              )}
            </div>
          )}
        </section>

        <aside className="atendente__lateral">
          <section aria-labelledby="titulo-fila" className="cartao">
            <h2 id="titulo-fila" className="cartao__titulo">Aguardando</h2>
            <ul className="fila-resumo">
              {['SP', 'SE', 'SG'].map((t) => (
                <li key={t} className={`fila-resumo__item fila-resumo__item--${t}`}>
                  <span>{NOMES_TIPO[t]}</span>
                  <strong>{fila[t]}</strong>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="titulo-historico" className="cartao">
            <h2 id="titulo-historico" className="cartao__titulo">Suas senhas encerradas hoje</h2>
            {historico.length === 0 ? (
              <p className="texto-suave">Nenhuma senha encerrada ainda.</p>
            ) : (
              <ul className="historico">
                {historico.map((h) => (
                  <li key={h.codigo} className="historico__item">
                    <span className="historico__codigo">{h.codigo}</span>
                    <span className={`selo selo--${h.estado}`}>{ROTULO_ESTADO[h.estado]}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
