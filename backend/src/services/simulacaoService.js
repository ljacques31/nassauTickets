import { pool, transacao } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { ESTADOS } from '../domain/estados.js';
import { formatarCodigo } from '../domain/numeracao.js';
import { escolherProximoTipo } from '../domain/prioridade.js';
import { agora, dataISO, dataDeISO, minutosDe, paraSQL } from '../domain/relogio.js';
import { obterConfig } from './configService.js';
import { emitirSenha } from './senhaService.js';

const uniforme = (min, max) => min + Math.random() * (max - min);

/**
 * Parâmetros do Agente Cliente simulado.
 * A taxa de 5% de não comparecimento vem da atividade. Os tempos de atendimento por tipo
 * são parâmetros adotados pelo grupo e podem ser ajustados aqui sem mexer no algoritmo.
 */
export const PARAMETROS_SIMULACAO = {
  distribuicaoTipos: { SP: 0.2, SE: 0.3, SG: 0.5 },
  taxaNaoComparecimento: 0.05,
  taxaSegundaChamada: 0.1, // clientes presentes que só respondem à segunda chamada
  tempoAtendimentoMin: {
    SP: () => uniforme(10, 20), // 15 min, variando 5 para mais ou para menos
    SG: () => uniforme(2, 8), //   5 min, variando 3 para mais ou para menos
    SE: () => (Math.random() < 0.95 ? uniforme(0.5, 1) : 5), // 95% até 1 min, 5% com 5 min
  },
  minutosEntreChamadas: 1,
  deslocamentoAteGuicheSeg: [20, 90],
  intervaloEntreAtendimentosSeg: [5, 20],
};

function sortearTipo() {
  const r = Math.random();
  const { SP, SE } = PARAMETROS_SIMULACAO.distribuicaoTipos;
  if (r < SP) return 'SP';
  if (r < SP + SE) return 'SE';
  return 'SG';
}

const somarSeg = (d, s) => new Date(d.getTime() + s * 1000);

/**
 * Gera um dia completo de atendimento em uma data passada, aplicando a MESMA regra de
 * prioridade do sistema real, a máquina de estados e a taxa de 5% de não comparecimento.
 * Serve para povoar os relatórios diário e mensal e demonstrar os indicadores.
 */
export async function simularDia({ data, quantidade, substituir = false }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) throw new ErroNegocio(400, 'DATA_INVALIDA', 'Informe a data no formato AAAA-MM-DD.');
  if (data >= dataISO(agora())) throw new ErroNegocio(400, 'DATA_INVALIDA', 'Escolha uma data anterior a hoje.');
  const n = Number(quantidade);
  if (!Number.isInteger(n) || n < 10 || n > 900) throw new ErroNegocio(400, 'QUANTIDADE_INVALIDA', 'Quantidade deve ser de 10 a 900 senhas.');

  const [[{ reais, simuladas }]] = await pool.query(
    'SELECT COALESCE(SUM(simulada = 0), 0) AS reais, COALESCE(SUM(simulada = 1), 0) AS simuladas FROM senhas WHERE data_emissao = ?', [data]);
  if (Number(reais) > 0) throw new ErroNegocio(409, 'DIA_COM_ATENDIMENTOS', 'Esta data já tem atendimentos reais.');
  if (Number(simuladas) > 0 && !substituir) {
    throw new ErroNegocio(409, 'DIA_JA_SIMULADO', 'Esta data já foi simulada. Marque "substituir" para gerar de novo.');
  }

  const [guiches] = await pool.query('SELECT id, numero FROM guiches WHERE ativo = 1 ORDER BY numero');
  const [atendentes] = await pool.query('SELECT id FROM usuarios WHERE ativo = 1 AND perfil_atendente = 1 ORDER BY id');
  if (!guiches.length || !atendentes.length) throw new ErroNegocio(409, 'SEM_GUICHES', 'Cadastre ao menos um guichê e um atendente ativos.');

  const cfg = await obterConfig();
  const base = dataDeISO(data);
  const abertura = somarSeg(base, minutosDe(cfg.hora_abertura) * 60);
  const fechamento = somarSeg(base, minutosDe(cfg.hora_fechamento) * 60);
  const duracaoSeg = (fechamento - abertura) / 1000;
  const P = PARAMETROS_SIMULACAO;

  // 1. Agente Cliente: emissões espalhadas pelo expediente.
  const senhas = Array.from({ length: n }, () => ({
    tipo: sortearTipo(),
    emitidaEm: somarSeg(abertura, Math.random() * duracaoSeg),
    faltara: Math.random() < P.taxaNaoComparecimento,
  })).sort((a, b) => a.emitidaEm - b.emitidaEm);

  const seq = { SP: 0, SE: 0, SG: 0 };
  for (const s of senhas) {
    seq[s.tipo] += 1;
    s.sequencia = seq[s.tipo];
    s.codigo = formatarCodigo(base, s.tipo, s.sequencia);
  }

  // 2. Agente Atendente: cada guichê chama a próxima quando fica livre, usando a regra real.
  const postos = guiches.map((g, i) => ({ guiche: g, usuarioId: atendentes[i % atendentes.length].id, livreEm: abertura }));
  const filas = { SP: [], SE: [], SG: [] };
  let proximaChegada = 0;
  let ultimoTipo = null;

  for (;;) {
    const ativos = postos.filter((p) => p.livreEm < fechamento);
    if (!ativos.length) break;
    const posto = ativos.reduce((a, b) => (b.livreEm < a.livreEm ? b : a));
    const T = posto.livreEm;

    while (proximaChegada < senhas.length && senhas[proximaChegada].emitidaEm <= T) {
      const s = senhas[proximaChegada++];
      filas[s.tipo].push(s);
    }
    const tipo = escolherProximoTipo(ultimoTipo, { SP: filas.SP.length, SE: filas.SE.length, SG: filas.SG.length });
    if (!tipo) {
      if (proximaChegada < senhas.length) { posto.livreEm = senhas[proximaChegada].emitidaEm; continue; }
      posto.livreEm = fechamento;
      continue;
    }
    ultimoTipo = tipo;
    const s = filas[tipo].shift();
    s.guicheId = posto.guiche.id;
    s.usuarioId = posto.usuarioId;
    s.primeira = T;

    if (s.faltara) {
      s.segunda = somarSeg(T, P.minutosEntreChamadas * 60);
      s.encerrada = somarSeg(s.segunda, P.minutosEntreChamadas * 60);
      s.estado = ESTADOS.NAO_COMPARECEU;
      posto.livreEm = s.encerrada;
      continue;
    }
    let chegadaBase = T;
    if (Math.random() < P.taxaSegundaChamada) {
      s.segunda = somarSeg(T, P.minutosEntreChamadas * 60);
      chegadaBase = s.segunda;
    }
    s.inicio = somarSeg(chegadaBase, uniforme(...P.deslocamentoAteGuicheSeg));
    s.fim = somarSeg(s.inicio, P.tempoAtendimentoMin[tipo]() * 60);
    s.encerrada = s.fim;
    s.estado = ESTADOS.ATENDIDA;
    posto.livreEm = somarSeg(s.fim, uniforme(...P.intervaloEntreAtendimentosSeg));
  }
  for (const tipo of Object.keys(filas)) {
    for (const s of filas[tipo]) { s.estado = ESTADOS.DESCARTADA; s.encerrada = fechamento; }
  }
  for (let i = proximaChegada; i < senhas.length; i++) { senhas[i].estado = ESTADOS.DESCARTADA; senhas[i].encerrada = fechamento; }

  // 3. Gravação em uma única transação, com a trilha de auditoria completa.
  const sql = (d) => (d ? paraSQL(d) : null);
  await transacao(async (conn) => {
    if (Number(simuladas) > 0) {
      await conn.query('DELETE FROM senhas WHERE data_emissao = ? AND simulada = 1', [data]);
      await conn.query('DELETE FROM sequencias_diarias WHERE data = ?', [data]);
    }
    for (let i = 0; i < senhas.length; i += 400) {
      const lote = senhas.slice(i, i + 400).map((s) => [
        s.codigo, s.tipo, s.sequencia, data, sql(s.emitidaEm), s.estado, s.guicheId ?? null, s.usuarioId ?? null,
        sql(s.primeira), sql(s.segunda), sql(s.inicio), sql(s.fim), sql(s.encerrada), 1,
      ]);
      await conn.query(
        `INSERT INTO senhas (codigo, tipo, sequencia, data_emissao, emitida_em, estado, guiche_id, usuario_id,
           primeira_chamada_em, segunda_chamada_em, inicio_atendimento_em, fim_atendimento_em, encerrada_em, simulada)
         VALUES ?`, [lote]);
    }
    const [ids] = await conn.query('SELECT id, codigo FROM senhas WHERE data_emissao = ?', [data]);
    const idPorCodigo = Object.fromEntries(ids.map((l) => [l.codigo, l.id]));

    const eventos = [];
    for (const s of senhas) {
      const id = idPorCodigo[s.codigo];
      const ev = (de, para, em, detalhe, comAtendente = true) => eventos.push([
        id, de, para, comAtendente ? s.usuarioId ?? null : null, comAtendente ? s.guicheId ?? null : null, sql(em), detalhe,
      ]);
      ev(null, 'EMITIDA', s.emitidaEm, 'Simulação: emitida no totem', false);
      ev('EMITIDA', 'AGUARDANDO', s.emitidaEm, null, false);
      if (s.estado === ESTADOS.DESCARTADA) { ev('AGUARDANDO', 'DESCARTADA', s.encerrada, 'Fim do expediente', false); continue; }
      ev('AGUARDANDO', 'CHAMADA', s.primeira, 'Primeira chamada');
      let anterior = 'CHAMADA';
      if (s.segunda) { ev('CHAMADA', 'CHAMADA_NOVAMENTE', s.segunda, 'Segunda chamada (última chamada)'); anterior = 'CHAMADA_NOVAMENTE'; }
      if (s.estado === ESTADOS.NAO_COMPARECEU) { ev(anterior, 'NAO_COMPARECEU', s.encerrada, 'Não compareceu após duas chamadas'); continue; }
      ev(anterior, 'EM_ATENDIMENTO', s.inicio, 'Cliente compareceu ao guichê');
      ev('EM_ATENDIMENTO', 'ATENDIDA', s.fim, 'Atendimento concluído');
    }
    for (let i = 0; i < eventos.length; i += 1000) {
      await conn.query(
        `INSERT INTO senha_eventos (senha_id, estado_anterior, estado_novo, usuario_id, guiche_id, ocorrido_em, detalhe) VALUES ?`,
        [eventos.slice(i, i + 1000)]);
    }
    for (const tipo of Object.keys(seq)) {
      if (seq[tipo] > 0) {
        await conn.query('INSERT INTO sequencias_diarias (data, tipo, ultimo) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ultimo = VALUES(ultimo)',
          [data, tipo, seq[tipo]]);
      }
    }
  });

  const contar = (estado) => senhas.filter((s) => s.estado === estado).length;
  return {
    data,
    emitidas: senhas.length,
    atendidas: contar(ESTADOS.ATENDIDA),
    naoCompareceram: contar(ESTADOS.NAO_COMPARECEU),
    descartadas: contar(ESTADOS.DESCARTADA),
    guiches: guiches.length,
  };
}

/** Emite um lote de senhas agora, como se vários clientes usassem o totem (demonstração ao vivo). */
export async function emitirLote({ quantidade }) {
  const n = Number(quantidade);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw new ErroNegocio(400, 'QUANTIDADE_INVALIDA', 'Quantidade deve ser de 1 a 50.');
  const emitidas = [];
  for (let i = 0; i < n; i++) {
    const { senha } = await emitirSenha({ tipo: sortearTipo(), simulada: true });
    emitidas.push(senha.codigo);
  }
  return { emitidas };
}
