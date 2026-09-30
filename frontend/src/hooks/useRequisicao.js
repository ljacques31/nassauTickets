import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

/** Executa uma chamada autenticada; se a sessão tiver expirado (401), volta para o login. */
export function useRequisicao() {
  const { token, expirar } = useAuth();
  return useCallback(async (fn) => {
    try {
      return await fn(token);
    } catch (erro) {
      if (erro.status === 401) expirar();
      throw erro;
    }
  }, [token, expirar]);
}
