import { Router } from 'express';
import { bancoDisponivel } from '../config/db.js';
import { ErroNegocio } from '../domain/erros.js';
import { NOMES_TIPO } from '../domain/prioridade.js';
import { agora, paraSQL } from '../domain/relogio.js';
import { limitePorIp } from '../middlewares/limiteRequisicoes.js';
import { listarGuiches } from '../services/cadastroService.js';
import { obterConfig, expedienteAberto, emDemonstracao } from '../services/configService.js';
import { registrarCliente, ultimasChamadas, contagemFila, totalClientes } from '../services/painelService.js';
import { emitirSenha } from '../services/senhaService.js';

const rotas = Router();
const assinc = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** Saúde da API e do banco (usado pelo frontend para detectar falhas). */
rotas.get('/health', assinc(async (_req, res) => {
  const db = await bancoDisponivel();
  res.status(db ? 200 : 503).json({ api: true, db, servidorEm: paraSQL(agora()), conexoesTempoReal: totalClientes() });
}));

/** Situação do expediente para o totem. */
rotas.get('/expediente', assinc(async (_req, res) => {
  const cfg = await obterConfig();
  res.json({
    aberto: expedienteAberto(cfg),
    horaAbertura: cfg.hora_abertura,
    horaFechamento: cfg.hora_fechamento,
    demonstracao: emDemonstracao(cfg),
    tipos: NOMES_TIPO,
  });
}));

/** Totem: emissão anônima de senha. Cabeçalho Idempotency-Key evita duplicidade em reenvios. */
rotas.post('/senhas', limitePorIp({ maximo: 30, janelaMs: 60000 }), assinc(async (req, res) => {
  const chave = req.get('Idempotency-Key');
  if (chave && !/^[A-Za-z0-9-]{8,64}$/.test(chave)) {
    throw new ErroNegocio(400, 'CHAVE_INVALIDA', 'Idempotency-Key inválida.');
  }
  const { senha, repetida } = await emitirSenha({ tipo: req.body?.tipo, idempotencyKey: chave || null });
  res.status(repetida ? 200 : 201).json(senha);
}));

/** Painel: últimas 5 senhas chamadas (a próxima nunca é exposta). */
rotas.get('/painel', assinc(async (_req, res) => {
  res.json({ ultimas: await ultimasChamadas(5) });
}));

rotas.get('/fila', assinc(async (_req, res) => {
  res.json(await contagemFila());
}));

/** Guichês ativos, para a tela de login do atendente. */
rotas.get('/guiches', assinc(async (_req, res) => {
  const guiches = await listarGuiches({ somenteAtivos: true });
  res.json(guiches.map(({ id, numero, descricao, ocupante }) => ({ id, numero, descricao, ocupado: !!ocupante })));
}));

/** Canal de tempo real (SSE). */
rotas.get('/eventos', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  registrarCliente(res);
  bancoDisponivel().then((db) => res.write(`event: status\ndata: ${JSON.stringify({ db, servidorEm: paraSQL(agora()) })}\n\n`));
  const manter = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => clearInterval(manter));
});

export default rotas;
