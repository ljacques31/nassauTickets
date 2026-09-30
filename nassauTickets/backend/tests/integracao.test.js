// Testes de integração com MySQL real, em um banco separado (nassau_tickets_test).
// Se o banco não estiver acessível, os testes são pulados com aviso.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DB_NAME = 'nassau_tickets_test';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let disponivel = true;
try {
  execFileSync('node', ['database/setup.js', '--reset'], { cwd: raiz, env: process.env, stdio: 'pipe' });
} catch {
  disponivel = false;
  console.warn('MySQL indisponível: testes de integração pulados. Configure backend/.env.');
}
const opcoes = { skip: !disponivel && 'MySQL indisponível' };

let pool, emitirSenha, chamarProxima, iniciarAtendimento, finalizarAtendimento, chamarNovamente,
  registrarNaoComparecimento, descartarFila, salvarConfig, escolherProximoTipo, resumo, detalhado, simularDia, hashSenha;

before(async () => {
  if (!disponivel) return;
  ({ pool } = await import('../src/config/db.js'));
  ({ emitirSenha } = await import('../src/services/senhaService.js'));
  ({ chamarProxima, iniciarAtendimento, finalizarAtendimento, chamarNovamente, registrarNaoComparecimento } =
    await import('../src/services/atendimentoService.js'));
  ({ descartarFila } = await import('../src/services/expedienteService.js'));
  ({ salvarConfig } = await import('../src/services/configService.js'));
  ({ escolherProximoTipo } = await import('../src/domain/prioridade.js'));
  ({ resumo, detalhado } = await import('../src/services/relatorioService.js'));
  ({ simularDia } = await import('../src/services/simulacaoService.js'));
  ({ hashSenha } = await import('../src/services/authService.js'));
  await salvarConfig({ modo_demonstracao: true });
});

after(async () => { if (pool) await pool.end(); });

async function limparSenhasDeHoje() {
  await pool.query('DELETE FROM senhas');
  await pool.query('DELETE FROM sequencias_diarias');
  await pool.query('UPDATE controle_fila SET ultimo_tipo = NULL, data_referencia = NULL');
}

/** Cria n atendentes, cada um ocupando um guichê. */
async function criarPostos(n) {
  const hash = await hashSenha('teste123');
  const postos = [];
  for (let i = 1; i <= n; i++) {
    await pool.query('INSERT IGNORE INTO guiches (numero) VALUES (?)', [100 + i]);
    await pool.query('INSERT IGNORE INTO usuarios (nome, login, senha_hash) VALUES (?, ?, ?)', [`Teste ${i}`, `teste${i}`, hash]);
    const [[g]] = await pool.query('SELECT id FROM guiches WHERE numero = ?', [100 + i]);
    const [[u]] = await pool.query('SELECT id FROM usuarios WHERE login = ?', [`teste${i}`]);
    await pool.query('UPDATE guiches SET ocupante_id = ? WHERE id = ?', [u.id, g.id]);
    postos.push({ usuarioId: u.id, guicheId: g.id });
  }
  return postos;
}

test('emissão concorrente: 60 totens ao mesmo tempo geram 001 a 060 sem repetir', opcoes, async () => {
  await limparSenhasDeHoje();
  const resultados = await Promise.all(Array.from({ length: 60 }, () => emitirSenha({ tipo: 'SG' })));
  const seqs = resultados.map((r) => Number(r.senha.codigo.slice(-3))).sort((a, b) => a - b);
  assert.deepEqual(seqs, Array.from({ length: 60 }, (_, i) => i + 1));
});

test('idempotência: a mesma chave devolve a mesma senha', opcoes, async () => {
  const a = await emitirSenha({ tipo: 'SE', idempotencyKey: 'chave-idem-12345' });
  const b = await emitirSenha({ tipo: 'SE', idempotencyKey: 'chave-idem-12345' });
  assert.equal(a.senha.codigo, b.senha.codigo);
  assert.equal(b.repetida, true);
});

test('concorrência: 8 atendentes chamando ao mesmo tempo nunca recebem a mesma senha e a ordem de prioridade é mantida', opcoes, async () => {
  await limparSenhasDeHoje();
  const tipos = [];
  for (let i = 0; i < 80; i++) tipos.push(['SP', 'SE', 'SG', 'SG', 'SG'][i % 5]);
  for (const tipo of tipos) await emitirSenha({ tipo });
  const postos = await criarPostos(8);

  // Cada atendente chama, inicia e finaliza em laço, todos em paralelo, até a fila acabar.
  await Promise.all(postos.map(async (p) => {
    for (;;) {
      const s = await chamarProxima(p);
      if (!s) return;
      await iniciarAtendimento({ senhaId: s.id, usuarioId: p.usuarioId });
      await finalizarAtendimento({ senhaId: s.id, usuarioId: p.usuarioId });
    }
  }));

  const [[{ repetidas }]] = await pool.query(
    `SELECT COUNT(*) AS repetidas FROM (SELECT senha_id FROM senha_eventos WHERE estado_novo = 'CHAMADA'
      GROUP BY senha_id HAVING COUNT(*) > 1) x`);
  assert.equal(Number(repetidas), 0, 'nenhuma senha foi chamada duas vezes');

  const [[{ atendidas }]] = await pool.query("SELECT COUNT(*) AS atendidas FROM senhas WHERE estado = 'ATENDIDA'");
  assert.equal(Number(atendidas), 80, 'todas as senhas foram atendidas');

  // Reproduz a regra de prioridade e compara com a ordem real das chamadas.
  const [chamadas] = await pool.query(
    `SELECT s.tipo FROM senha_eventos e JOIN senhas s ON s.id = e.senha_id WHERE e.estado_novo = 'CHAMADA' ORDER BY e.id`);
  const filas = { SP: 16, SE: 16, SG: 48 };
  let ultimo = null;
  const esperado = [];
  for (;;) { const t = escolherProximoTipo(ultimo, filas); if (!t) break; filas[t]--; esperado.push(t); ultimo = t; }
  assert.deepEqual(chamadas.map((c) => c.tipo), esperado);
});

test('rajada: 10 atendentes clicam no mesmo instante com 10 senhas na fila', opcoes, async () => {
  await limparSenhasDeHoje();
  for (let i = 0; i < 10; i++) await emitirSenha({ tipo: i % 2 ? 'SG' : 'SP' });
  const postos = await criarPostos(10);
  const chamadas = await Promise.all(postos.map((p) => chamarProxima(p)));
  const codigos = chamadas.map((s) => s.codigo);
  assert.equal(new Set(codigos).size, 10);
  for (const [i, p] of postos.entries()) {
    await iniciarAtendimento({ senhaId: chamadas[i].id, usuarioId: p.usuarioId });
    await finalizarAtendimento({ senhaId: chamadas[i].id, usuarioId: p.usuarioId });
  }
});

test('fim do expediente: descarta a fila e preserva atendimentos iniciados', opcoes, async () => {
  await limparSenhasDeHoje();
  const [p] = await criarPostos(1);
  for (let i = 0; i < 4; i++) await emitirSenha({ tipo: 'SG' });
  const emAtendimento = await chamarProxima(p);
  await iniciarAtendimento({ senhaId: emAtendimento.id, usuarioId: p.usuarioId });

  const descartadas = await descartarFila({ incluirHoje: true });
  assert.equal(descartadas, 3);
  const [[s]] = await pool.query('SELECT estado FROM senhas WHERE id = ?', [emAtendimento.id]);
  assert.equal(s.estado, 'EM_ATENDIMENTO');
  const fim = await finalizarAtendimento({ senhaId: emAtendimento.id, usuarioId: p.usuarioId });
  assert.equal(fim.estado, 'ATENDIDA', 'o atendente conclui mesmo após o fechamento');
});

test('não comparecimento e relatório detalhado com campos de atendimento em branco', opcoes, async () => {
  await limparSenhasDeHoje();
  const [p] = await criarPostos(1);
  await emitirSenha({ tipo: 'SP' });
  const s = await chamarProxima(p);
  await chamarNovamente({ senhaId: s.id, usuarioId: p.usuarioId });
  await registrarNaoComparecimento({ senhaId: s.id, usuarioId: p.usuarioId });

  const hoje = s.emitidaEm.slice(0, 10);
  const det = await detalhado({ periodo: 'dia', data: hoje });
  const linha = det.linhas.find((l) => l.codigo === s.codigo);
  assert.equal(linha.estado, 'NAO_COMPARECEU');
  assert.equal(linha.atendimentoEm, null);
  assert.equal(linha.guiche, null);
});

test('simulação de dia: cerca de 5% de não comparecimento e relatórios consistentes', opcoes, async () => {
  const r = await simularDia({ data: '2026-01-15', quantidade: 600 });
  const taxa = r.naoCompareceram / r.emitidas;
  assert.ok(taxa > 0.02 && taxa < 0.09, `taxa de não comparecimento ${taxa}`);
  assert.equal(r.atendidas + r.naoCompareceram + r.descartadas, r.emitidas);

  const rel = await resumo({ periodo: 'mes', mes: '2026-01' });
  assert.equal(rel.geral.emitidas, 600);
  assert.equal(rel.porTipo.reduce((a, t) => a + t.emitidas, 0), 600);
  assert.ok(rel.geral.tempoMedioAtendimentoSeg > 0);
});
