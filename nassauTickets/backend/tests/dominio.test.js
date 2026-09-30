// Testes unitários das regras de negócio puras (não precisam de banco).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordemDeBusca, escolherProximoTipo } from '../src/domain/prioridade.js';
import { formatarCodigo, validarCodigo } from '../src/domain/numeracao.js';
import { podeTransitar, ESTADOS as E } from '../src/domain/estados.js';
import { expedienteAberto, expedienteEncerrado } from '../src/services/configService.js';

test('prioridade: depois de SP a vez é de SE, depois SG', () => {
  assert.deepEqual(ordemDeBusca('SP'), ['SE', 'SG', 'SP']);
});

test('prioridade: depois de SE, SG ou no início do dia a vez é de SP', () => {
  for (const ultimo of ['SE', 'SG', null]) assert.deepEqual(ordemDeBusca(ultimo), ['SP', 'SE', 'SG']);
});

test('prioridade: fila vazia é pulada seguindo a ordem', () => {
  assert.equal(escolherProximoTipo('SP', { SP: 3, SE: 0, SG: 2 }), 'SG');
  assert.equal(escolherProximoTipo('SP', { SP: 3, SE: 0, SG: 0 }), 'SP');
  assert.equal(escolherProximoTipo('SG', { SP: 0, SE: 1, SG: 5 }), 'SE');
  assert.equal(escolherProximoTipo(null, { SP: 0, SE: 0, SG: 0 }), null);
});

test('prioridade: sequência completa [SP] -> [SE|SG] -> [SP] -> [SE|SG]', () => {
  const filas = { SP: 3, SE: 1, SG: 3 };
  const chamadas = [];
  let ultimo = null;
  for (;;) {
    const t = escolherProximoTipo(ultimo, filas);
    if (!t) break;
    filas[t] -= 1; chamadas.push(t); ultimo = t;
  }
  assert.deepEqual(chamadas, ['SP', 'SE', 'SP', 'SG', 'SP', 'SG', 'SG']);
});

test('numeração: formato YYMMDD-PPSQ com três dígitos', () => {
  const d = new Date(2026, 8, 29);
  assert.equal(formatarCodigo(d, 'SP', 1), '260929-SP001');
  assert.equal(formatarCodigo(d, 'SG', 42), '260929-SG042');
  assert.equal(formatarCodigo(new Date(2027, 0, 5), 'SE', 999), '270105-SE999');
  assert.ok(validarCodigo('260929-SE123'));
  assert.ok(!validarCodigo('260929-SX123'));
});

test('numeração: acima de 999 por tipo no dia é recusado', () => {
  assert.throws(() => formatarCodigo(new Date(), 'SG', 1000), { codigo: 'LIMITE_DIARIO' });
});

test('máquina de estados: caminho feliz', () => {
  const caminho = [E.EMITIDA, E.AGUARDANDO, E.CHAMADA, E.CHAMADA_NOVAMENTE, E.EM_ATENDIMENTO, E.ATENDIDA];
  for (let i = 0; i < caminho.length - 1; i++) assert.ok(podeTransitar(caminho[i], caminho[i + 1]));
  assert.ok(podeTransitar(E.CHAMADA, E.EM_ATENDIMENTO), 'cliente que atende à primeira chamada');
});

test('máquina de estados: não comparecimento só após a segunda chamada', () => {
  assert.ok(podeTransitar(E.CHAMADA_NOVAMENTE, E.NAO_COMPARECEU));
  assert.ok(!podeTransitar(E.CHAMADA, E.NAO_COMPARECEU));
  assert.ok(!podeTransitar(E.CHAMADA_NOVAMENTE, E.CHAMADA_NOVAMENTE), 'não existe terceira chamada');
});

test('máquina de estados: estados finais não mudam e atendimento iniciado não é descartado', () => {
  for (const final of [E.ATENDIDA, E.NAO_COMPARECEU, E.DESCARTADA]) {
    for (const outro of Object.values(E)) assert.ok(!podeTransitar(final, outro));
  }
  assert.ok(!podeTransitar(E.EM_ATENDIMENTO, E.DESCARTADA));
  assert.ok(podeTransitar(E.AGUARDANDO, E.DESCARTADA));
});

test('expediente: 7h às 17h', () => {
  const cfg = { hora_abertura: '07:00', hora_fechamento: '17:00', modo_demonstracao: '0' };
  const as = (h, m) => new Date(2026, 8, 29, h, m);
  assert.ok(!expedienteAberto(cfg, as(6, 59)));
  assert.ok(expedienteAberto(cfg, as(7, 0)));
  assert.ok(expedienteAberto(cfg, as(16, 59)));
  assert.ok(!expedienteAberto(cfg, as(17, 0)));
  assert.ok(expedienteEncerrado(cfg, as(17, 0)));
  assert.ok(!expedienteEncerrado(cfg, as(12, 0)));
  assert.ok(expedienteAberto({ ...cfg, modo_demonstracao: '1' }, as(22, 0)), 'modo demonstração ignora o horário');
});
