import { useEffect, useState } from 'react';
import Barras from '../../components/Barras.jsx';
import Indicador from '../../components/Indicador.jsx';
import Mensagem from '../../components/Mensagem.jsx';
import SeletorPeriodo from '../../components/SeletorPeriodo.jsx';
import Tabela from '../../components/Tabela.jsx';
import { useRequisicao } from '../../hooks/useRequisicao.js';
import { api } from '../../services/api.js';
import { duracao, hojeISO, numero, percentual } from '../../utils/formatadores.js';

const COR = { SP: 'var(--sp)', SE: 'var(--se)', SG: 'var(--sg)' };

/**
 * Proposta de acompanhamento do desempenho: tempo médio de espera (TME), tempo médio de
 * atendimento (TMA), taxas de atendimento e de não comparecimento, produtividade por guichê
 * e por atendente e a distribuição do movimento ao longo do dia.
 */
export default function Desempenho() {
  const requisitar = useRequisicao();
  const hoje = hojeISO();
  const [filtro, setFiltro] = useState({ periodo: 'mes', data: hoje, mes: hoje.slice(0, 7) });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const parametros = filtro.periodo === 'dia' ? { periodo: 'dia', data: filtro.data } : { periodo: 'mes', mes: filtro.mes };
    if (!parametros.data && !parametros.mes) return;
    let cancelado = false;
    setErro('');
    requisitar((t) => api.gestor.relatorio(t, 'desempenho', parametros))
      .then((d) => { if (!cancelado) setDados(d); })
      .catch((e) => { if (!cancelado) setErro(e.message); });
    return () => { cancelado = true; };
  }, [filtro]);

  const ind = dados?.indicadores;

  return (
    <section aria-labelledby="titulo-desempenho">
      <div className="cabecalho-secao">
        <h1 id="titulo-desempenho">Desempenho dos atendimentos</h1>
      </div>
      <div className="filtros"><SeletorPeriodo valor={filtro} aoMudar={setFiltro} /></div>
      <Mensagem tipo="erro">{erro}</Mensagem>

      {dados && (
        <>
          <div className="grade-indicadores">
            <Indicador rotulo="Tempo médio de espera" valor={duracao(ind.tempoMedioEsperaSeg)} detalhe="Da emissão até a primeira chamada" />
            <Indicador rotulo="Tempo médio de atendimento" valor={duracao(ind.tempoMedioAtendimentoSeg)} detalhe="Do início à finalização" />
            <Indicador rotulo="Taxa de atendimento" valor={percentual(ind.taxaAtendimento)} detalhe="Atendidas sobre emitidas" />
            <Indicador rotulo="Não comparecimento" valor={percentual(ind.taxaNaoComparecimento)} detalhe="Referência esperada: cerca de 5%" />
            <Indicador rotulo="Descarte no fechamento" valor={percentual(ind.taxaDescarte)} detalhe="Senhas que ficaram na fila às 17h" />
            <Indicador rotulo="Chamadas realizadas" valor={numero(ind.chamadasRealizadas)} />
          </div>

          <div className="grade-graficos">
            <Barras titulo="Tempo médio de espera por tipo" formatar={duracao}
              itens={dados.porTipo.map((t) => ({ rotulo: `${t.tipo} ${t.tipoNome}`, valor: t.tempoMedioEsperaSeg, cor: COR[t.tipo] }))} />
            <Barras titulo="Tempo médio de atendimento por tipo" formatar={duracao}
              itens={dados.porTipo.map((t) => ({ rotulo: `${t.tipo} ${t.tipoNome}`, valor: t.tempoMedioAtendimentoSeg, cor: COR[t.tipo] }))} />
            <Barras titulo="Senhas emitidas por hora" formatar={numero}
              itens={dados.porHora.map((h) => ({ rotulo: `${String(h.hora).padStart(2, '0')}h`, valor: h.emitidas }))} />
            <Barras titulo="Tempo médio de espera por hora" formatar={duracao} cor="var(--aviso)"
              itens={dados.porHora.map((h) => ({ rotulo: `${String(h.hora).padStart(2, '0')}h`, valor: h.tempoMedioEsperaSeg }))} />
            <Barras titulo="Atendimentos por guichê" formatar={numero}
              itens={dados.porGuiche.map((g) => ({ rotulo: `Guichê ${g.guiche}`, valor: g.atendidas }))} />
          </div>

          <h2 className="titulo-tabela">Por atendente</h2>
          <Tabela
            legenda="Desempenho por atendente"
            chave="atendente"
            linhas={dados.porAtendente}
            colunas={[
              { titulo: 'Atendente', campo: 'atendente' },
              { titulo: 'Atendidas', campo: 'atendidas', alinhar: 'direita' },
              { titulo: 'Não compareceram', campo: 'naoCompareceram', alinhar: 'direita' },
              { titulo: 'Tempo médio de atendimento', render: (l) => duracao(l.tempoMedioAtendimentoSeg), alinhar: 'direita' },
            ]}
          />
        </>
      )}
    </section>
  );
}
