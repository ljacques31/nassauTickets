import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);
const CHAVE = 'nassauTickets.sessao';

// sessionStorage: cada aba tem sua própria sessão, o que permite abrir
// vários guichês no mesmo computador durante testes e apresentações.
function lerSessao() {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(lerSessao);

  const entrar = useCallback(async (dados) => {
    const resposta = await api.login(dados);
    sessionStorage.setItem(CHAVE, JSON.stringify(resposta));
    setSessao(resposta);
    return resposta.usuario;
  }, []);

  const sair = useCallback(async () => {
    const token = sessao?.token;
    sessionStorage.removeItem(CHAVE);
    setSessao(null);
    if (token) {
      try { await api.logout(token); } catch { /* sessão já encerrada no servidor */ }
    }
  }, [sessao]);

  /** Usado quando a API responde 401: a sessão expirou. */
  const expirar = useCallback(() => {
    sessionStorage.removeItem(CHAVE);
    setSessao(null);
  }, []);

  const valor = useMemo(() => ({
    token: sessao?.token ?? null,
    usuario: sessao?.usuario ?? null,
    entrar,
    sair,
    expirar,
  }), [sessao, entrar, sair, expirar]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
