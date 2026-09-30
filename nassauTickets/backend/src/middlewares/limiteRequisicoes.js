import { ErroNegocio } from '../domain/erros.js';

/** Limite simples por IP (protege o totem contra emissão em massa). */
export function limitePorIp({ maximo, janelaMs }) {
  const acessos = new Map();
  setInterval(() => {
    const limite = Date.now() - janelaMs;
    for (const [ip, lista] of acessos) {
      const recentes = lista.filter((t) => t > limite);
      if (recentes.length) acessos.set(ip, recentes); else acessos.delete(ip);
    }
  }, janelaMs).unref();

  return (req, _res, next) => {
    const ip = req.ip;
    const limite = Date.now() - janelaMs;
    const lista = (acessos.get(ip) || []).filter((t) => t > limite);
    if (lista.length >= maximo) {
      return next(new ErroNegocio(429, 'MUITAS_REQUISICOES', 'Muitas solicitações em pouco tempo. Aguarde um instante.'));
    }
    lista.push(Date.now());
    acessos.set(ip, lista);
    next();
  };
}
