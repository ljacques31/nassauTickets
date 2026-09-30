import { pool, transacao } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { ESTADOS, ESTADOS_ATIVOS, exigirTransicao } from '../domain/estados.js';
import { ordemDeBusca, NOMES_TIPO } from '../domain/prioridade.js';
import { agora, dataISO, paraSQL } from '../domain/relogio.js';
import { registrarEvento } from './eventoService.js';
import { publicar, publicarFila, ultimasChamadas } from './painelService.js';

const SQL_SENHA = `
  SELECT s.*, g.numero AS guiche_numero
    FROM senhas s
    LEFT JOIN guiches g ON g.id = s.guiche_id`;

export function senhaParaJSON(s) {
  if (!s) return null;
  return {
    id: s.id,
    codigo: s.codigo,
    tipo: s.tipo,
    tipoNome: NOMES_TIPO[s.tipo],
    estado: s.estado,
    guiche: s.guiche_numero ?? null,
    emitidaEm: s.emitida_em,
    primeiraChamadaEm: s.primeira_chamada_em,
    segundaChamadaEm: s.segunda_chamada_em,
    inicioAtendimentoEm: s.inicio_atendimento_em,
    fimAtendimentoEm: s.fim_atendimento_em,
    // Instante absoluto (ms desde 1970) para o cronômetro do guichê, imune a diferença de fuso do navegador.
    inicioAtendimentoEpoch: s.inicio_atendimento_em ? new Date(s.inicio_atendimento_em.replace(' ', 'T')).getTime() : null,
  };
}

/** Senha que está com o atendente neste momento (chamada, chamada novamente ou em atendimento). */
export async function senhaAtivaDoAtendente(usuarioId, conn = pool, bloquear = false) {
  const [[s]] = await conn.query(
    `${SQL_SENHA} WHERE s.usuario_id = ? AND s.estado IN (?) ORDER BY s.id LIMIT 1 ${bloquear ? 'FOR UPDATE' : ''}`,
    [usuarioId, ESTADOS_ATIVOS],
  );
  return s || null;
}

async function anunciarChamada(senha, ultimaChamada) {
  try {
    publicar('chamada', {
      chamada: {
        codigo: senha.codigo,
        tipo: senha.tipo,
        tipoNome: NOMES_TIPO[senha.tipo],
        guiche: senha.guiche_numero,
        ultimaChamada,
      },
      ultimas: await ultimasChamadas(),
    });
  } catch { /* o painel recarrega as últimas chamadas ao reconectar */ }
}

/**
 * Chama a próxima senha para o guichê do atendente.
 *
 * Concorrência: a linha única de controle_fila é bloqueada com SELECT ... FOR UPDATE.
 * Se dois ou mais atendentes clicarem ao mesmo tempo, o MySQL enfileira as transações:
 * cada uma enxerga o resultado da anterior, recebe uma senha diferente e a alternância
 * SP / SE|SG é preservada. Nenhuma senha é entregue a dois guichês.
 */
export async function chamarProxima({ usuarioId, guicheId }) {
  const resultado = await transacao(async (conn) => {
    const momento = agora();
    const hoje = dataISO(momento);

    const [[controle]] = await conn.query('SELECT * FROM controle_fila WHERE id = 1 FOR UPDATE');
    const ultimoTipo = controle && controle.data_referencia === hoje ? controle.ultimo_tipo : null;

    const ativa = await senhaAtivaDoAtendente(usuarioId, conn, true);
    if (ativa) {
      throw new ErroNegocio(409, 'SENHA_ATIVA',
        `Conclua a senha ${ativa.codigo} antes de chamar a próxima.`, senhaParaJSON(ativa));
    }

    for (const tipo of ordemDeBusca(ultimoTipo)) {
      const [[candidata]] = await conn.query(
        `SELECT id, estado FROM senhas
          WHERE estado = 'AGUARDANDO' AND tipo = ? AND data_emissao = ?
          ORDER BY id LIMIT 1 FOR UPDATE`,
        [tipo, hoje],
      );
      if (!candidata) continue;

      exigirTransicao(candidata.estado, ESTADOS.CHAMADA);
      const em = paraSQL(momento);
      await conn.query(
        `UPDATE senhas SET estado = ?, guiche_id = ?, usuario_id = ?, primeira_chamada_em = ? WHERE id = ?`,
        [ESTADOS.CHAMADA, guicheId, usuarioId, em, candidata.id],
      );
      await registrarEvento(conn, {
        senhaId: candidata.id, de: candidata.estado, para: ESTADOS.CHAMADA,
        usuarioId, guicheId, em, detalhe: 'Primeira chamada',
      });
      await conn.query(
        'INSERT INTO controle_fila (id, ultimo_tipo, data_referencia, atualizado_em) VALUES (1, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE ultimo_tipo = VALUES(ultimo_tipo), data_referencia = VALUES(data_referencia), atualizado_em = VALUES(atualizado_em)',
        [tipo, hoje, em],
      );
      const [[senha]] = await conn.query(`${SQL_SENHA} WHERE s.id = ?`, [candidata.id]);
      return senha;
    }
    return null; // todas as filas vazias
  });

  if (resultado) {
    await anunciarChamada(resultado, false);
    publicarFila();
  }
  return senhaParaJSON(resultado);
}

/** Carrega e bloqueia a senha, garantindo que pertence ao atendente que está agindo. */
async function senhaDoAtendente(conn, senhaId, usuarioId) {
  const [[s]] = await conn.query(`${SQL_SENHA} WHERE s.id = ? FOR UPDATE`, [senhaId]);
  if (!s) throw new ErroNegocio(404, 'SENHA_NAO_ENCONTRADA', 'Senha não encontrada.');
  if (s.usuario_id !== usuarioId) {
    throw new ErroNegocio(403, 'SENHA_DE_OUTRO_ATENDENTE', 'Esta senha está com outro atendente.');
  }
  return s;
}

async function transitar({ senhaId, usuarioId, para, campos = {}, detalhe }) {
  return transacao(async (conn) => {
    const s = await senhaDoAtendente(conn, senhaId, usuarioId);
    exigirTransicao(s.estado, para);
    const em = paraSQL(agora());
    const sets = ['estado = ?'];
    const valores = [para];
    for (const campo of Object.keys(campos)) {
      sets.push(`${campo} = ?`);
      valores.push(em);
    }
    await conn.query(`UPDATE senhas SET ${sets.join(', ')} WHERE id = ?`, [...valores, senhaId]);
    await registrarEvento(conn, {
      senhaId, de: s.estado, para, usuarioId, guicheId: s.guiche_id, em, detalhe,
    });
    const [[atualizada]] = await conn.query(`${SQL_SENHA} WHERE s.id = ?`, [senhaId]);
    return atualizada;
  });
}

/** Segunda e última chamada. Repete o áudio no painel com a indicação "Última chamada". */
export async function chamarNovamente({ senhaId, usuarioId }) {
  const s = await transitar({
    senhaId, usuarioId, para: ESTADOS.CHAMADA_NOVAMENTE,
    campos: { segunda_chamada_em: true }, detalhe: 'Segunda chamada (última chamada)',
  });
  await anunciarChamada(s, true);
  return senhaParaJSON(s);
}

export async function iniciarAtendimento({ senhaId, usuarioId }) {
  const s = await transitar({
    senhaId, usuarioId, para: ESTADOS.EM_ATENDIMENTO,
    campos: { inicio_atendimento_em: true }, detalhe: 'Cliente compareceu ao guichê',
  });
  return senhaParaJSON(s);
}

export async function finalizarAtendimento({ senhaId, usuarioId }) {
  const s = await transitar({
    senhaId, usuarioId, para: ESTADOS.ATENDIDA,
    campos: { fim_atendimento_em: true, encerrada_em: true }, detalhe: 'Atendimento concluído',
  });
  return senhaParaJSON(s);
}

/** Só é permitido depois da segunda chamada (a máquina de estados garante isso). */
export async function registrarNaoComparecimento({ senhaId, usuarioId }) {
  const s = await transitar({
    senhaId, usuarioId, para: ESTADOS.NAO_COMPARECEU,
    campos: { encerrada_em: true }, detalhe: 'Não compareceu após duas chamadas',
  });
  return senhaParaJSON(s);
}

/** Atendimentos concluídos hoje pelo atendente (para a tela do guichê). */
export async function historicoDoDia(usuarioId) {
  const [linhas] = await pool.query(
    `${SQL_SENHA} WHERE s.usuario_id = ? AND s.data_emissao = ? AND s.estado IN ('ATENDIDA','NAO_COMPARECEU')
     ORDER BY s.encerrada_em DESC LIMIT 20`,
    [usuarioId, dataISO(agora())],
  );
  return linhas.map(senhaParaJSON);
}
