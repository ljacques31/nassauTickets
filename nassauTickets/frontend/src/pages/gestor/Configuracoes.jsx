import { useEffect, useState } from 'react';
import Botao from '../../components/Botao.jsx';
import Campo from '../../components/Campo.jsx';
import Mensagem from '../../components/Mensagem.jsx';
import { useRequisicao } from '../../hooks/useRequisicao.js';
import { api } from '../../services/api.js';

function ontemISO() {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Configuracoes() {
  const requisitar = useRequisicao();
  const [config, setConfig] = useState(null);
  const [simulacao, setSimulacao] = useState({ data: ontemISO(), quantidade: 250, substituir: false });
  const [lote, setLote] = useState(10);
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState('');

  useEffect(() => {
    requisitar(api.gestor.configuracoes).then(setConfig).catch((e) => setMensagem({ tipo: 'erro', texto: e.message }));
  }, []);

  async function executar(chave, fn, sucesso) {
    setOcupado(chave);
    setMensagem(null);
    try {
      const r = await requisitar(fn);
      setMensagem({ tipo: 'sucesso', texto: sucesso(r) });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e.message });
    } finally {
      setOcupado('');
    }
  }

  const salvarConfig = (e) => {
    e.preventDefault();
    executar('config', (t) => api.gestor.salvarConfiguracoes(t, config), (r) => { setConfig(r); return 'Expediente atualizado.'; });
  };

  const encerrar = () => {
    if (!window.confirm('Descartar todas as senhas que ainda estão na fila? Atendimentos já iniciados continuam.')) return;
    executar('encerrar', api.gestor.encerrarExpediente, (r) => `${r.descartadas} senha(s) descartada(s).`);
  };

  const simularDia = (e) => {
    e.preventDefault();
    executar('dia', (t) => api.gestor.simularDia(t, { ...simulacao, quantidade: Number(simulacao.quantidade) }),
      (r) => `Dia ${r.data.split('-').reverse().join('/')} simulado: ${r.emitidas} emitidas, ${r.atendidas} atendidas, `
        + `${r.naoCompareceram} não compareceram e ${r.descartadas} descartadas, com ${r.guiches} guichê(s).`);
  };

  const emitirLote = (e) => {
    e.preventDefault();
    executar('lote', (t) => api.gestor.emitirLote(t, { quantidade: Number(lote) }),
      (r) => `${r.emitidas.length} senha(s) emitida(s): ${r.emitidas.join(', ')}.`);
  };

  return (
    <section aria-labelledby="titulo-config">
      <div className="cabecalho-secao"><h1 id="titulo-config">Expediente e simulação</h1></div>
      <Mensagem tipo={mensagem?.tipo} aoFechar={() => setMensagem(null)}>{mensagem?.texto}</Mensagem>

      <div className="grade-cartoes">
        {config && (
          <form className="cartao formulario" onSubmit={salvarConfig}>
            <h2 className="cartao__titulo">Horário do expediente</h2>
            <p className="texto-suave">O totem emite senhas apenas nesse intervalo. No fechamento, as senhas que ficaram na fila são descartadas.</p>
            <div className="linha-campos">
              <Campo rotulo="Abertura">
                {(id) => <input id={id} type="time" value={config.horaAbertura} onChange={(e) => setConfig({ ...config, horaAbertura: e.target.value })} required />}
              </Campo>
              <Campo rotulo="Fechamento">
                {(id) => <input id={id} type="time" value={config.horaFechamento} onChange={(e) => setConfig({ ...config, horaFechamento: e.target.value })} required />}
              </Campo>
            </div>
            <label className="marcacao">
              <input type="checkbox" checked={config.modoDemonstracao} onChange={(e) => setConfig({ ...config, modoDemonstracao: e.target.checked })} />
              Modo demonstração: permite emitir senhas fora do horário (para testes e apresentações)
            </label>
            <div className="formulario__acoes">
              <Botao type="submit" carregando={ocupado === 'config'}>Salvar expediente</Botao>
              <Botao variante="perigo" onClick={encerrar} disabled={!!ocupado}>Encerrar expediente agora</Botao>
            </div>
          </form>
        )}

        <form className="cartao formulario" onSubmit={simularDia}>
          <h2 className="cartao__titulo">Simular um dia de atendimento</h2>
          <p className="texto-suave">
            Gera clientes e atendimentos em uma data passada usando a mesma regra de prioridade do sistema,
            com cerca de 5% das senhas sem comparecimento. Serve para povoar os relatórios diário e mensal.
          </p>
          <div className="linha-campos">
            <Campo rotulo="Data">
              {(id) => <input id={id} type="date" max={ontemISO()} value={simulacao.data} onChange={(e) => setSimulacao({ ...simulacao, data: e.target.value })} required />}
            </Campo>
            <Campo rotulo="Quantidade de senhas">
              {(id) => <input id={id} type="number" min="10" max="900" value={simulacao.quantidade} onChange={(e) => setSimulacao({ ...simulacao, quantidade: e.target.value })} required />}
            </Campo>
          </div>
          <label className="marcacao">
            <input type="checkbox" checked={simulacao.substituir} onChange={(e) => setSimulacao({ ...simulacao, substituir: e.target.checked })} />
            Substituir uma simulação anterior desta data
          </label>
          <div className="formulario__acoes"><Botao type="submit" carregando={ocupado === 'dia'}>Simular dia</Botao></div>
        </form>

        <form className="cartao formulario" onSubmit={emitirLote}>
          <h2 className="cartao__titulo">Emitir senhas de teste agora</h2>
          <p className="texto-suave">Cria senhas de tipos variados na fila de hoje, como se vários clientes usassem o totem.</p>
          <Campo rotulo="Quantidade (1 a 50)">
            {(id) => <input id={id} type="number" min="1" max="50" value={lote} onChange={(e) => setLote(e.target.value)} required />}
          </Campo>
          <div className="formulario__acoes"><Botao type="submit" carregando={ocupado === 'lote'}>Emitir senhas</Botao></div>
        </form>
      </div>
    </section>
  );
}
