import { ErroNegocio } from '../domain/erros.js';

const ERROS_DE_BANCO = new Set([
  'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR', 'ECONNRESET', 'ER_CON_COUNT_ERROR', 'POOL_CLOSED',
]);

export function rotaNaoEncontrada(req, _res, next) {
  next(new ErroNegocio(404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.path} não existe.`));
}

// eslint-disable-next-line no-unused-vars
export function tratarErros(erro, req, res, _next) {
  if (erro instanceof ErroNegocio) {
    return res.status(erro.status).json({ erro: { codigo: erro.codigo, mensagem: erro.message, dados: erro.dados } });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: { codigo: 'JSON_INVALIDO', mensagem: 'Corpo da requisição não é um JSON válido.' } });
  }
  if (ERROS_DE_BANCO.has(erro.code) || erro.fatal) {
    console.error(`[banco] ${req.method} ${req.path}: ${erro.code || erro.message}`);
    return res.status(503).json({
      erro: { codigo: 'BANCO_INDISPONIVEL', mensagem: 'O banco de dados está indisponível no momento. Tente novamente em instantes.' },
    });
  }
  console.error(`[erro] ${req.method} ${req.path}`, erro);
  return res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro inesperado no servidor.' } });
}
