import { useEffect, useState } from 'react';
import Botao from '../../components/Botao.jsx';
import Campo from '../../components/Campo.jsx';
import Indicador from '../../components/Indicador.jsx';
import Mensagem from '../../components/Mensagem.jsx';
import Paginacao from '../../components/Paginacao.jsx';
import SeletorPeriodo from '../../components/SeletorPeriodo.jsx';
import Tabela from '../../components/Tabela.jsx';
import { useRequisicao } from '../../hooks/useRequisicao.js';
import { api } from '../../services/api.js';
import { baixarCsv } from '../../utils/csv.js';
import { NOMES_TIPO, ROTULO_ESTADO, dataHora, duracao, hojeISO, numero } from '../../utils/formatadores.js';

const COLUNAS_TIPO = [
  { titulo: 'Tipo', render: (l) => <span className={`etiqueta etiqueta--${l.tipo}`}>{l.tipo} {l.tipoNome}</span> },
  { titulo: 'Emitidas', campo: 'emitidas', alinhar: 'direita' },
  { titulo: 'Atendidas', campo: 'atendidas', alinhar: 'direita' },
  { titulo: 'Não compareceram', campo: 'naoCompareceram', alinhar: 'direita' },
  { titulo: 'Descartadas', campo: 'descartadas', alinhar: 'direita' },
  { titulo: 'Tempo médio de atendimento', render: (l) => duracao(l.tempoMedioAtendimentoSeg), alinhar: 'direita' },
  { titulo: 'Tempo médio de espera', render: (l) => duracao(l.tempoMedioEsperaSeg), alinhar: 'direita' },
];

// Relatório detalhado: campos de atendimento ficam em branco para senhas não atendidas.
const COLUNAS_DETALHADO = [
  { titulo: 'Senha', campo: 'codigo' },
  { titulo: 'Tipo', campo: 'tipo' },
  { titulo: 'Emissão', campo: 'emitidaEm', render: (l) => dataHora(l.emitidaEm), csv: (l) => dataHora(l.emitidaEm) },
  { titulo: 'Atendimento', render: (l) => dataHora(l.atendimentoEm), csv: (l) => dataHora(l.atendimentoEm) },
  { titulo: 'Guichê', campo: 'guiche', alinhar: 'direita' },
  { titulo: 'Situação', render: (l) => ROTULO_ESTADO[l.estado], csv: (l) => ROTULO_ESTADO[l.estado] },
];

export default function Relatorios() {
  const requisitar = useRequisicao();
  const hoje = hojeISO();
  const [filtro, setFiltro] = useState({ periodo: 'dia', data: hoje, mes: hoje.slice(0, 7) });
  const [aba, setAba] = useState('resumo');
  const [resumo, setResumo] = useState(null);
  const [lista, setLista] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [tipo, setTipo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [linhaDoTempo, setLinhaDoTempo] = useState(null);

  const parametros = filtro.periodo === 'dia' ? { periodo: 'dia', data: filtro.data } : { periodo: 'mes', mes: filtro.mes };
  const filtroValido = filtro.periodo === 'dia' ? !!filtro.data : !!filtro.mes;

  useEffect(() => { setPagina(1); }, [filtro, aba, tipo]);

  useEffect(() => {
    if (!filtroValido) return;
    let cancelado = false;
    setCarregando(true);
    setErro('');
    const pedido = aba === 'resumo'
      ? requisitar((t) => api.gestor.relatorio(t, 'resumo', parametros))
      : requisitar((t) => api.gestor.relatorio(t, aba, { ...parametros, pagina, tamanho: 50, ...(tipo ? { tipo } : {}) }));
    pedido
      .then((dados) => { if (!cancelado) (aba === 'resumo' ? setResumo : setLista)(dados); })
      .catch((e) => { if (!cancelado) setErro(e.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [filtro, aba, pagina, tipo]);

  const colunasAuditoria = [
    { titulo: 'Atendente', campo: 'atendente' },
    { titulo: 'Guichê', campo: 'guiche', alinhar: 'direita' },
    {
      titulo: 'Senha', campo: 'codigo',
      render: (l) => <button type="button" className="link-tabela" onClick={() => abrirLinhaDoTempo(l.codigo)}>{l.codigo}</button>,
    },
    { titulo: '1ª chamada', render: (l) => dataHora(l.primeiraChamadaEm), csv: (l) => dataHora(l.primeiraChamadaEm) },
    { titulo: '2ª chamada', render: (l) => dataHora(l.segundaChamadaEm), csv: (l) => dataHora(l.segundaChamadaEm) },
    { titulo: 'Início do atendimento', render: (l) => dataHora(l.inicioAtendimentoEm), csv: (l) => dataHora(l.inicioAtendimentoEm) },
    { titulo: 'Finalização', render: (l) => dataHora(l.fimAtendimentoEm), csv: (l) => dataHora(l.fimAtendimentoEm) },
    { titulo: 'Situação', render: (l) => ROTULO_ESTADO[l.estado], csv: (l) => ROTULO_ESTADO[l.estado] },
  ];

  async function abrirLinhaDoTempo(codigo) {
    try {
      setLinhaDoTempo({ codigo, eventos: await requisitar((t) => api.gestor.eventosSenha(t, codigo)) });
    } catch (e) {
      setErro(e.message);
    }
  }

  /** Exporta TODAS as páginas do relatório escolhido. */
  async function exportar() {
    const rotulo = filtro.periodo === 'dia' ? filtro.data : filtro.mes;
    try {
      if (aba === 'resumo') {
        const linhas = resumo.porTipo.map((l) => ({ ...l, tma: duracao(l.tempoMedioAtendimentoSeg), tme: duracao(l.tempoMedioEsperaSeg) }));
        const g = resumo.geral;
        linhas.push({ tipo: 'TOTAL', tipoNome: '', emitidas: g.emitidas, atendidas: g.atendidas, naoCompareceram: g.naoCompareceram,
          descartadas: g.descartadas, tma: duracao(g.tempoMedioAtendimentoSeg), tme: duracao(g.tempoMedioEsperaSeg) });
        baixarCsv(`resumo-${rotulo}.csv`, [
          { titulo: 'Tipo', campo: 'tipo' }, { titulo: 'Descrição', campo: 'tipoNome' }, { titulo: 'Emitidas', campo: 'emitidas' },
          { titulo: 'Atendidas', campo: 'atendidas' }, { titulo: 'Não compareceram', campo: 'naoCompareceram' },
          { titulo: 'Descartadas', campo: 'descartadas' }, { titulo: 'Tempo médio de atendimento', campo: 'tma' },
          { titulo: 'Tempo médio de espera', campo: 'tme' },
        ], linhas);
        return;
      }
      const todas = [];
      for (let p = 1; ; p++) {
        const parte = await requisitar((t) => api.gestor.relatorio(t, aba, { ...parametros, pagina: p, tamanho: 1000, ...(tipo ? { tipo } : {}) }));
        todas.push(...parte.linhas);
        if (todas.length >= parte.total) break;
      }
      const colunas = aba === 'detalhado' ? COLUNAS_DETALHADO : colunasAuditoria;
      baixarCsv(`${aba}-${rotulo}.csv`, colunas.map((c) => ({ ...c, csv: c.csv || ((l) => l[c.campo]) })), todas);
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <section className="relatorios" aria-labelledby="titulo-relatorios">
      <div className="cabecalho-secao">
        <h1 id="titulo-relatorios">Relatórios</h1>
        <div className="cabecalho-secao__acoes nao-imprimir">
          <Botao variante="secundario" onClick={exportar} disabled={carregando || (aba === 'resumo' ? !resumo : !lista)}>Exportar CSV</Botao>
          <Botao variante="secundario" onClick={() => window.print()}>Imprimir</Botao>
        </div>
      </div>

      <div className="filtros nao-imprimir">
        <SeletorPeriodo valor={filtro} aoMudar={setFiltro} />
        {aba === 'detalhado' && (
          <Campo rotulo="Tipo de senha">
            {(id) => (
              <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(NOMES_TIPO).map(([t, n]) => <option key={t} value={t}>{t} {n}</option>)}
              </select>
            )}
          </Campo>
        )}
      </div>

      <div className="subabas nao-imprimir" role="tablist" aria-label="Tipo de relatório">
        {[['resumo', 'Quantitativos e tempo médio'], ['detalhado', 'Detalhado das senhas'], ['auditoria', 'Auditoria']].map(([chave, rotulo]) => (
          <button key={chave} type="button" role="tab" aria-selected={aba === chave}
            className={`subabas__item ${aba === chave ? 'ativo' : ''}`} onClick={() => setAba(chave)}>
            {rotulo}
          </button>
        ))}
      </div>

      <p className="so-impressao">
        Relatório {filtro.periodo === 'dia' ? `diário de ${filtro.data.split('-').reverse().join('/')}` : `mensal de ${filtro.mes.split('-').reverse().join('/')}`}
      </p>
      <Mensagem tipo="erro" aoFechar={erro ? () => setErro('') : undefined}>{erro}</Mensagem>
      {carregando && <p className="texto-suave" role="status">Carregando relatório...</p>}

      {aba === 'resumo' && resumo && !carregando && (
        <>
          <div className="grade-indicadores">
            <Indicador rotulo="Senhas emitidas" valor={numero(resumo.geral.emitidas)} />
            <Indicador rotulo="Senhas atendidas" valor={numero(resumo.geral.atendidas)} />
            <Indicador rotulo="Não compareceram" valor={numero(resumo.geral.naoCompareceram)} />
            <Indicador rotulo="Descartadas no fim do expediente" valor={numero(resumo.geral.descartadas)} />
            <Indicador rotulo="Tempo médio de atendimento" valor={duracao(resumo.geral.tempoMedioAtendimentoSeg)} />
            <Indicador rotulo="Tempo médio de espera" valor={duracao(resumo.geral.tempoMedioEsperaSeg)} />
          </div>
          <h2 className="titulo-tabela">Por prioridade</h2>
          <Tabela colunas={COLUNAS_TIPO} linhas={resumo.porTipo} chave="tipo" legenda="Quantitativos por prioridade" />
        </>
      )}

      {aba !== 'resumo' && lista && !carregando && (
        <>
          <Tabela
            colunas={aba === 'detalhado' ? COLUNAS_DETALHADO : colunasAuditoria}
            linhas={lista.linhas}
            chave="codigo"
            legenda={aba === 'detalhado' ? 'Relatório detalhado das senhas' : 'Relatório de auditoria'}
          />
          <Paginacao pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} aoMudar={setPagina} />
        </>
      )}

      {linhaDoTempo && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-linha">
          <div className="modal__caixa">
            <h2 id="titulo-linha">Trilha da senha {linhaDoTempo.codigo}</h2>
            <ol className="linha-tempo">
              {linhaDoTempo.eventos.map((e, i) => (
                <li key={i}>
                  <strong>{ROTULO_ESTADO[e.para]}</strong> em {dataHora(e.em)}
                  {e.atendente && <> por {e.atendente}, guichê {e.guiche}</>}
                  {e.detalhe && <span className="texto-suave">. {e.detalhe}</span>}
                </li>
              ))}
            </ol>
            <Botao onClick={() => setLinhaDoTempo(null)} autoFocus>Fechar</Botao>
          </div>
        </div>
      )}
    </section>
  );
}
