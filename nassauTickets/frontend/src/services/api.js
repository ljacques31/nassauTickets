// Cliente da API REST. Toda troca de dados é JSON.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const URL_EVENTOS = `${BASE}/eventos`;

export class ErroApi extends Error {
  constructor(status, codigo, mensagem, dados) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.dados = dados;
  }

  /** Falha de infraestrutura (rede, servidor ou banco), e não de regra de negócio. */
  get indisponibilidade() {
    return this.status === 0 || this.status === 503 || this.status >= 500;
  }
}

export async function requisitar(caminho, { metodo = 'GET', corpo, token, cabecalhos = {}, tempoLimiteMs = 8000 } = {}) {
  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), tempoLimiteMs);
  try {
    const resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...cabecalhos,
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
    if (resposta.status === 204) return null;
    let dados = null;
    try { dados = await resposta.json(); } catch { /* resposta sem corpo JSON */ }
    if (!resposta.ok) {
      throw new ErroApi(
        resposta.status,
        dados?.erro?.codigo || 'ERRO_HTTP',
        dados?.erro?.mensagem || 'O servidor não conseguiu concluir a operação.',
        dados?.erro?.dados,
      );
    }
    return dados;
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro;
    if (erro.name === 'AbortError') throw new ErroApi(0, 'TEMPO_ESGOTADO', 'O servidor demorou para responder.');
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor.');
  } finally {
    clearTimeout(temporizador);
  }
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Totem: emite a senha com chave de idempotência. Em falha de rede, reenvia com a MESMA chave,
 * então o servidor devolve a mesma senha em vez de criar outra.
 */
export async function emitirSenha(tipo) {
  const chave = crypto.randomUUID();
  let ultimoErro;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return await requisitar('/senhas', { metodo: 'POST', corpo: { tipo }, cabecalhos: { 'Idempotency-Key': chave } });
    } catch (erro) {
      ultimoErro = erro;
      if (!erro.indisponibilidade) throw erro;
      await espera(700 * (tentativa + 1));
    }
  }
  throw ultimoErro;
}

export const api = {
  expediente: () => requisitar('/expediente'),
  painel: () => requisitar('/painel'),
  fila: () => requisitar('/fila'),
  guiches: () => requisitar('/guiches'),
  saude: () => requisitar('/health'),

  login: (dados) => requisitar('/auth/login', { metodo: 'POST', corpo: dados }),
  logout: (token) => requisitar('/auth/logout', { metodo: 'POST', token }),

  atual: (token) => requisitar('/atendimento/atual', { token }),
  historico: (token) => requisitar('/atendimento/historico', { token }),
  chamarProxima: (token) => requisitar('/atendimento/chamar-proxima', { metodo: 'POST', token }),
  acaoSenha: (token, id, acao) => requisitar(`/atendimento/senhas/${id}/${acao}`, { metodo: 'POST', token }),

  gestor: {
    usuarios: (token) => requisitar('/gestor/usuarios', { token }),
    criarUsuario: (token, dados) => requisitar('/gestor/usuarios', { metodo: 'POST', corpo: dados, token }),
    atualizarUsuario: (token, id, dados) => requisitar(`/gestor/usuarios/${id}`, { metodo: 'PUT', corpo: dados, token }),
    guiches: (token) => requisitar('/gestor/guiches', { token }),
    criarGuiche: (token, dados) => requisitar('/gestor/guiches', { metodo: 'POST', corpo: dados, token }),
    atualizarGuiche: (token, id, dados) => requisitar(`/gestor/guiches/${id}`, { metodo: 'PUT', corpo: dados, token }),
    relatorio: (token, tipo, filtro) =>
      requisitar(`/gestor/relatorios/${tipo}?${new URLSearchParams(filtro)}`, { token, tempoLimiteMs: 20000 }),
    eventosSenha: (token, codigo) => requisitar(`/gestor/relatorios/senhas/${encodeURIComponent(codigo)}/eventos`, { token }),
    configuracoes: (token) => requisitar('/gestor/configuracoes', { token }),
    salvarConfiguracoes: (token, dados) => requisitar('/gestor/configuracoes', { metodo: 'PUT', corpo: dados, token }),
    encerrarExpediente: (token) => requisitar('/gestor/expediente/encerrar', { metodo: 'POST', token }),
    simularDia: (token, dados) => requisitar('/gestor/simulacao/dia', { metodo: 'POST', corpo: dados, token, tempoLimiteMs: 30000 }),
    emitirLote: (token, dados) => requisitar('/gestor/simulacao/lote', { metodo: 'POST', corpo: dados, token, tempoLimiteMs: 20000 }),
  },
};
