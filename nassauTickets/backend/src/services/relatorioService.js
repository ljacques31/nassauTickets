import { pool } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { NOMES_TIPO, TIPOS } from '../domain/prioridade.js';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

/** Converte ?periodo=dia&data=YYYY-MM-DD ou ?periodo=mes&mes=YYYY-MM em intervalo de datas. */
export function intervaloDoPeriodo({ periodo = 'dia', data, mes }) {
  if (periodo === 'dia') {
    if (!DATA.test(data || '')) throw new ErroNegocio(400, 'DATA_INVALIDA', 'Informe a data no formato AAAA-MM-DD.');
    return { periodo, inicio: data, fim: data, rotulo: data };
  }
  if (periodo === 'mes') {
    if (!MES.test(mes || '')) throw new ErroNegocio(400, 'MES_INVALIDO', 'Informe o mês no formato AAAA-MM.');
    const [a, m] = mes.split('-').map(Number);
    const ultimoDia = new Date(a, m, 0).getDate();
    return { periodo, inicio: `${mes}-01`, fim: `${mes}-${String(ultimoDia).padStart(2, '0')}`, rotulo: mes };
  }
  throw new ErroNegocio(400, 'PERIODO_INVALIDO', 'Período deve ser "dia" ou "mes".');
}

const seg = (v) => (v === null || v === undefined ? null : Math.round(Number(v)));

/** Quantitativos gerais e por prioridade, tempo médio de atendimento e de espera. */
export async function resumo(filtro) {
  const { inicio, fim } = intervaloDoPeriodo(filtro);
  const [porTipo] = await pool.query(
    `SELECT tipo,
            COUNT(*)                              AS emitidas,
            SUM(estado = 'ATENDIDA')              AS atendidas,
            SUM(estado = 'NAO_COMPARECEU')        AS nao_compareceram,
            SUM(estado = 'DESCARTADA')            AS descartadas,
            AVG(CASE WHEN estado = 'ATENDIDA'
                     THEN TIMESTAMPDIFF(MICROSECOND, inicio_atendimento_em, fim_atendimento_em) / 1e6 END) AS tma,
            AVG(CASE WHEN primeira_chamada_em IS NOT NULL
                     THEN TIMESTAMPDIFF(MICROSECOND, emitida_em, primeira_chamada_em) / 1e6 END) AS tme
       FROM senhas
      WHERE data_emissao BETWEEN ? AND ?
      GROUP BY tipo`,
    [inicio, fim],
  );
  const [[geral]] = await pool.query(
    `SELECT COUNT(*) AS emitidas,
            COALESCE(SUM(estado = 'ATENDIDA'), 0)       AS atendidas,
            COALESCE(SUM(estado = 'NAO_COMPARECEU'), 0) AS nao_compareceram,
            COALESCE(SUM(estado = 'DESCARTADA'), 0)     AS descartadas,
            COALESCE(SUM(estado IN ('AGUARDANDO','CHAMADA','CHAMADA_NOVAMENTE','EM_ATENDIMENTO')), 0) AS em_aberto,
            AVG(CASE WHEN estado = 'ATENDIDA'
                     THEN TIMESTAMPDIFF(MICROSECOND, inicio_atendimento_em, fim_atendimento_em) / 1e6 END) AS tma,
            AVG(CASE WHEN primeira_chamada_em IS NOT NULL
                     THEN TIMESTAMPDIFF(MICROSECOND, emitida_em, primeira_chamada_em) / 1e6 END) AS tme
       FROM senhas
      WHERE data_emissao BETWEEN ? AND ?`,
    [inicio, fim],
  );

  const mapa = Object.fromEntries(porTipo.map((l) => [l.tipo, l]));
  return {
    periodo: intervaloDoPeriodo(filtro),
    geral: {
      emitidas: Number(geral.emitidas),
      atendidas: Number(geral.atendidas),
      naoCompareceram: Number(geral.nao_compareceram),
      descartadas: Number(geral.descartadas),
      emAberto: Number(geral.em_aberto),
      tempoMedioAtendimentoSeg: seg(geral.tma),
      tempoMedioEsperaSeg: seg(geral.tme),
    },
    porTipo: TIPOS.map((tipo) => {
      const l = mapa[tipo] || {};
      return {
        tipo,
        tipoNome: NOMES_TIPO[tipo],
        emitidas: Number(l.emitidas || 0),
        atendidas: Number(l.atendidas || 0),
        naoCompareceram: Number(l.nao_compareceram || 0),
        descartadas: Number(l.descartadas || 0),
        tempoMedioAtendimentoSeg: seg(l.tma),
        tempoMedioEsperaSeg: seg(l.tme),
      };
    }),
  };
}

/**
 * Relatório detalhado: número, tipo, emissão, atendimento e guichê.
 * Para senhas não atendidas, os campos de atendimento ficam em branco (null).
 */
export async function detalhado(filtro, { pagina = 1, tamanho = 100, tipo } = {}) {
  const { inicio, fim } = intervaloDoPeriodo(filtro);
  const p = Math.max(1, Number(pagina) || 1);
  const t = Math.min(1000, Math.max(10, Number(tamanho) || 100));
  const condTipo = TIPOS.includes(tipo) ? 'AND s.tipo = ?' : '';
  const params = TIPOS.includes(tipo) ? [inicio, fim, tipo] : [inicio, fim];

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM senhas s WHERE s.data_emissao BETWEEN ? AND ? ${condTipo}`, params);
  const [linhas] = await pool.query(
    `SELECT s.codigo, s.tipo, s.estado, s.emitida_em,
            CASE WHEN s.estado = 'ATENDIDA' THEN s.inicio_atendimento_em END AS atendimento_em,
            CASE WHEN s.estado = 'ATENDIDA' THEN s.fim_atendimento_em END    AS finalizado_em,
            CASE WHEN s.estado = 'ATENDIDA' THEN g.numero END                AS guiche
       FROM senhas s
       LEFT JOIN guiches g ON g.id = s.guiche_id
      WHERE s.data_emissao BETWEEN ? AND ? ${condTipo}
      ORDER BY s.emitida_em, s.id
      LIMIT ? OFFSET ?`,
    [...params, t, (p - 1) * t],
  );
  return {
    periodo: intervaloDoPeriodo(filtro),
    pagina: p,
    tamanho: t,
    total: Number(total),
    linhas: linhas.map((l) => ({
      codigo: l.codigo,
      tipo: l.tipo,
      estado: l.estado,
      emitidaEm: l.emitida_em,
      atendimentoEm: l.atendimento_em,
      finalizadoEm: l.finalizado_em,
      guiche: l.guiche,
    })),
  };
}

/** Auditoria: atendente, guichê, senha, 1ª e 2ª chamada, início e fim do atendimento. */
export async function auditoria(filtro, { pagina = 1, tamanho = 100 } = {}) {
  const { inicio, fim } = intervaloDoPeriodo(filtro);
  const p = Math.max(1, Number(pagina) || 1);
  const t = Math.min(1000, Math.max(10, Number(tamanho) || 100));
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM senhas WHERE data_emissao BETWEEN ? AND ? AND primeira_chamada_em IS NOT NULL`,
    [inicio, fim]);
  const [linhas] = await pool.query(
    `SELECT u.nome AS atendente, g.numero AS guiche, s.codigo, s.tipo, s.estado,
            s.primeira_chamada_em, s.segunda_chamada_em, s.inicio_atendimento_em, s.fim_atendimento_em
       FROM senhas s
       JOIN usuarios u ON u.id = s.usuario_id
       JOIN guiches g  ON g.id = s.guiche_id
      WHERE s.data_emissao BETWEEN ? AND ? AND s.primeira_chamada_em IS NOT NULL
      ORDER BY s.primeira_chamada_em, s.id
      LIMIT ? OFFSET ?`,
    [inicio, fim, t, (p - 1) * t],
  );
  return {
    periodo: intervaloDoPeriodo(filtro),
    pagina: p,
    tamanho: t,
    total: Number(total),
    linhas: linhas.map((l) => ({
      atendente: l.atendente,
      guiche: l.guiche,
      codigo: l.codigo,
      tipo: l.tipo,
      estado: l.estado,
      primeiraChamadaEm: l.primeira_chamada_em,
      segundaChamadaEm: l.segunda_chamada_em,
      inicioAtendimentoEm: l.inicio_atendimento_em,
      fimAtendimentoEm: l.fim_atendimento_em,
    })),
  };
}

/** Linha do tempo completa de uma senha (todas as transições registradas). */
export async function eventosDaSenha(codigo) {
  const [linhas] = await pool.query(
    `SELECT e.estado_anterior, e.estado_novo, e.ocorrido_em, e.detalhe, u.nome AS atendente, g.numero AS guiche
       FROM senha_eventos e
       JOIN senhas s ON s.id = e.senha_id
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       LEFT JOIN guiches g  ON g.id = e.guiche_id
      WHERE s.codigo = ?
      ORDER BY e.id`,
    [codigo],
  );
  if (linhas.length === 0) throw new ErroNegocio(404, 'SENHA_NAO_ENCONTRADA', 'Senha não encontrada.');
  return linhas.map((l) => ({
    de: l.estado_anterior, para: l.estado_novo, em: l.ocorrido_em,
    detalhe: l.detalhe, atendente: l.atendente, guiche: l.guiche,
  }));
}

/**
 * Indicadores de desempenho (proposta do grupo para quantificar e acompanhar os atendimentos):
 * TME (espera), TMA (atendimento), taxa de não comparecimento, produtividade por guichê e
 * por atendente e movimento por hora do dia.
 */
export async function desempenho(filtro) {
  const { inicio, fim } = intervaloDoPeriodo(filtro);
  const base = await resumo(filtro);

  const [porHora] = await pool.query(
    `SELECT HOUR(emitida_em) AS hora, COUNT(*) AS emitidas, SUM(estado = 'ATENDIDA') AS atendidas,
            AVG(CASE WHEN primeira_chamada_em IS NOT NULL
                     THEN TIMESTAMPDIFF(MICROSECOND, emitida_em, primeira_chamada_em) / 1e6 END) AS tme
       FROM senhas WHERE data_emissao BETWEEN ? AND ?
      GROUP BY HOUR(emitida_em) ORDER BY hora`,
    [inicio, fim]);

  const [porGuiche] = await pool.query(
    `SELECT g.numero AS guiche, COUNT(*) AS atendidas,
            AVG(TIMESTAMPDIFF(MICROSECOND, s.inicio_atendimento_em, s.fim_atendimento_em) / 1e6) AS tma
       FROM senhas s JOIN guiches g ON g.id = s.guiche_id
      WHERE s.data_emissao BETWEEN ? AND ? AND s.estado = 'ATENDIDA'
      GROUP BY g.numero ORDER BY g.numero`,
    [inicio, fim]);

  const [porAtendente] = await pool.query(
    `SELECT u.nome AS atendente, SUM(s.estado = 'ATENDIDA') AS atendidas,
            SUM(s.estado = 'NAO_COMPARECEU') AS nao_compareceram,
            AVG(CASE WHEN s.estado = 'ATENDIDA'
                     THEN TIMESTAMPDIFF(MICROSECOND, s.inicio_atendimento_em, s.fim_atendimento_em) / 1e6 END) AS tma
       FROM senhas s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.data_emissao BETWEEN ? AND ?
      GROUP BY u.id, u.nome ORDER BY atendidas DESC`,
    [inicio, fim]);

  const g = base.geral;
  const chamadas = g.atendidas + g.naoCompareceram;
  return {
    periodo: base.periodo,
    indicadores: {
      tempoMedioEsperaSeg: g.tempoMedioEsperaSeg,
      tempoMedioAtendimentoSeg: g.tempoMedioAtendimentoSeg,
      taxaNaoComparecimento: g.emitidas ? g.naoCompareceram / g.emitidas : 0,
      taxaDescarte: g.emitidas ? g.descartadas / g.emitidas : 0,
      taxaAtendimento: g.emitidas ? g.atendidas / g.emitidas : 0,
      chamadasRealizadas: chamadas,
    },
    porTipo: base.porTipo,
    porHora: porHora.map((l) => ({
      hora: Number(l.hora), emitidas: Number(l.emitidas), atendidas: Number(l.atendidas || 0), tempoMedioEsperaSeg: seg(l.tme),
    })),
    porGuiche: porGuiche.map((l) => ({ guiche: l.guiche, atendidas: Number(l.atendidas), tempoMedioAtendimentoSeg: seg(l.tma) })),
    porAtendente: porAtendente.map((l) => ({
      atendente: l.atendente, atendidas: Number(l.atendidas || 0),
      naoCompareceram: Number(l.nao_compareceram || 0), tempoMedioAtendimentoSeg: seg(l.tma),
    })),
  };
}
