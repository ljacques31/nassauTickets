import { Router } from 'express';
import { autenticar, exigirPerfil } from '../middlewares/autenticacao.js';
import { listarUsuarios, criarUsuario, atualizarUsuario, listarGuiches, salvarGuiche } from '../services/cadastroService.js';
import { obterConfig, salvarConfig, emDemonstracao } from '../services/configService.js';
import { descartarFila } from '../services/expedienteService.js';
import { resumo, detalhado, auditoria, desempenho, eventosDaSenha } from '../services/relatorioService.js';
import { simularDia, emitirLote } from '../services/simulacaoService.js';

const rotas = Router();
const assinc = (fn) => (req, res, next) => fn(req, res, next).catch(next);
rotas.use(autenticar, exigirPerfil('gestor'));

// Cadastros
rotas.get('/usuarios', assinc(async (_req, res) => res.json(await listarUsuarios())));
rotas.post('/usuarios', assinc(async (req, res) => res.status(201).json(await criarUsuario(req.body || {}))));
rotas.put('/usuarios/:id', assinc(async (req, res) =>
  res.json(await atualizarUsuario(Number(req.params.id), req.body || {}, req.usuario.id))));

rotas.get('/guiches', assinc(async (_req, res) => res.json(await listarGuiches())));
rotas.post('/guiches', assinc(async (req, res) => res.status(201).json(await salvarGuiche(null, req.body || {}))));
rotas.put('/guiches/:id', assinc(async (req, res) => res.json(await salvarGuiche(Number(req.params.id), req.body || {}))));

// Relatórios diário (?periodo=dia&data=AAAA-MM-DD) e mensal (?periodo=mes&mes=AAAA-MM)
rotas.get('/relatorios/resumo', assinc(async (req, res) => res.json(await resumo(req.query))));
rotas.get('/relatorios/detalhado', assinc(async (req, res) => res.json(await detalhado(req.query, req.query))));
rotas.get('/relatorios/auditoria', assinc(async (req, res) => res.json(await auditoria(req.query, req.query))));
rotas.get('/relatorios/desempenho', assinc(async (req, res) => res.json(await desempenho(req.query))));
rotas.get('/relatorios/senhas/:codigo/eventos', assinc(async (req, res) => res.json(await eventosDaSenha(req.params.codigo))));

// Expediente e configurações
rotas.get('/configuracoes', assinc(async (_req, res) => {
  const c = await obterConfig();
  res.json({ horaAbertura: c.hora_abertura, horaFechamento: c.hora_fechamento, modoDemonstracao: emDemonstracao(c) });
}));
rotas.put('/configuracoes', assinc(async (req, res) => {
  const { horaAbertura, horaFechamento, modoDemonstracao } = req.body || {};
  const c = await salvarConfig({ hora_abertura: horaAbertura, hora_fechamento: horaFechamento, modo_demonstracao: modoDemonstracao });
  res.json({ horaAbertura: c.hora_abertura, horaFechamento: c.hora_fechamento, modoDemonstracao: emDemonstracao(c) });
}));
rotas.post('/expediente/encerrar', assinc(async (_req, res) => {
  const descartadas = await descartarFila({ incluirHoje: true, motivo: 'Expediente encerrado pelo gestor' });
  res.json({ descartadas });
}));

// Simulação (demonstração dos relatórios e da regra de 5% de não comparecimento)
rotas.post('/simulacao/dia', assinc(async (req, res) => res.status(201).json(await simularDia(req.body || {}))));
rotas.post('/simulacao/lote', assinc(async (req, res) => res.status(201).json(await emitirLote(req.body || {}))));

export default rotas;
