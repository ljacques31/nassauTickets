import { useEffect, useState } from 'react';
import AvisoConexao from '../components/AvisoConexao.jsx';
import Botao from '../components/Botao.jsx';
import Canhoto from '../components/Canhoto.jsx';
import Marca from '../components/Marca.jsx';
import { useTempoReal } from '../hooks/useTempoReal.js';
import { api, emitirSenha } from '../services/api.js';
import { dataHora } from '../utils/formatadores.js';

const OPCOES = [
  { tipo: 'SG', titulo: 'Atendimento geral', texto: 'Coleta de exames e demais serviços' },
  { tipo: 'SE', titulo: 'Retirada de exames', texto: 'Buscar resultados que já estão prontos' },
  {
    tipo: 'SP', titulo: 'Atendimento prioritário',
    texto: 'Pessoas com 60 anos ou mais, gestantes, lactantes, pessoas com deficiência ou com criança de colo',
  },
];

const SEGUNDOS_PARA_VOLTAR = 15;

export default function Totem() {
  const [expediente, setExpediente] = useState(null);
  const [emitindo, setEmitindo] = useState(null); // tipo sendo emitido
  const [senha, setSenha] = useState(null);
  const [erro, setErro] = useState('');
  const [contagem, setContagem] = useState(SEGUNDOS_PARA_VOLTAR);
  const { conexao, bancoOk } = useTempoReal({ aoReconectar: () => carregarExpediente() });

  async function carregarExpediente() {
    try {
      setExpediente(await api.expediente());
    } catch {
      /* mantém o último estado conhecido; o aviso de conexão informa o problema */
    }
  }

  useEffect(() => {
    carregarExpediente();
    const id = setInterval(carregarExpediente, 60000);
    return () => clearInterval(id);
  }, []);

  // Volta sozinho para a tela inicial depois de mostrar a senha.
  useEffect(() => {
    if (!senha) return undefined;
    setContagem(SEGUNDOS_PARA_VOLTAR);
    const id = setInterval(() => {
      setContagem((c) => {
        if (c <= 1) { clearInterval(id); setSenha(null); return SEGUNDOS_PARA_VOLTAR; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [senha]);

  async function escolher(tipo) {
    setErro('');
    setEmitindo(tipo);
    try {
      setSenha(await emitirSenha(tipo));
    } catch (e) {
      setErro(e.indisponibilidade
        ? 'Não foi possível emitir a senha agora. Nenhuma senha foi gerada. Procure a recepção.'
        : e.message);
      if (e.codigo === 'FORA_DO_EXPEDIENTE') carregarExpediente();
    } finally {
      setEmitindo(null);
    }
  }

  const fechado = expediente && !expediente.aberto;
  const indisponivel = conexao === 'offline' || !bancoOk;

  return (
    <main className="totem">
      <header className="totem__topo">
        <Marca subtitulo="Retire sua senha" />
      </header>
      <AvisoConexao conexao={conexao} bancoOk={bancoOk} />

      {senha ? (
        <section className="totem__resultado" aria-live="assertive">
          <h1 className="totem__titulo">Sua senha</h1>
          <div className="area-impressao">
            <Canhoto codigo={senha.codigo} tipo={senha.tipo} tamanho="grande">
              <span className="canhoto__meta">Emitida em {dataHora(senha.emitidaEm)}</span>
              <span className="canhoto__meta">Acompanhe o painel. Você será chamado pelo número e pelo guichê.</span>
            </Canhoto>
          </div>
          <div className="totem__acoes">
            <Botao variante="secundario" grande onClick={() => window.print()}>Imprimir senha</Botao>
            <Botao grande onClick={() => setSenha(null)}>Concluir</Botao>
          </div>
          <p className="texto-suave">Esta tela volta ao início em {contagem} segundos.</p>
        </section>
      ) : (
        <section className="totem__escolha">
          <h1 className="totem__titulo">Qual atendimento você procura?</h1>
          {fechado && (
            <p className="totem__fechado" role="status">
              A emissão de senhas funciona das {expediente.horaAbertura} às {expediente.horaFechamento}.
            </p>
          )}
          {erro && <p className="totem__erro" role="alert">{erro}</p>}
          <div className="totem__opcoes">
            {OPCOES.map((o) => (
              <button
                key={o.tipo}
                type="button"
                className={`opcao-totem opcao-totem--${o.tipo}`}
                onClick={() => escolher(o.tipo)}
                disabled={!!emitindo || fechado || indisponivel}
              >
                <span className="opcao-totem__sigla" aria-hidden="true">{o.tipo}</span>
                <span className="opcao-totem__titulo">{emitindo === o.tipo ? 'Emitindo...' : o.titulo}</span>
                <span className="opcao-totem__texto">{o.texto}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
