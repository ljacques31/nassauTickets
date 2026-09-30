import { useEffect, useRef, useState } from 'react';
import { URL_EVENTOS } from '../services/api.js';

/**
 * Assina o canal de tempo real do servidor (Server Sent Events).
 * Devolve o estado da conexão e se o banco está respondendo.
 * O navegador reconecta sozinho; um vigia recria a conexão se nada chegar em 30 s.
 */
export function useTempoReal(ouvintes) {
  const [conexao, setConexao] = useState('conectando'); // conectando | online | offline
  const [bancoOk, setBancoOk] = useState(true);
  const ouvintesRef = useRef(ouvintes);

  useEffect(() => {
    ouvintesRef.current = ouvintes;
  });

  useEffect(() => {
    let fonte = null;
    let vigia = null;
    let ultimoSinal = Date.now();
    let encerrado = false;

    const sinal = () => { ultimoSinal = Date.now(); };

    const abrir = () => {
      fonte?.close();
      fonte = new EventSource(URL_EVENTOS);
      fonte.onopen = () => {
        sinal();
        setConexao('online');
        ouvintesRef.current.aoReconectar?.();
      };
      fonte.onerror = () => setConexao('offline');
      fonte.addEventListener('status', (e) => {
        sinal();
        const dados = JSON.parse(e.data);
        setBancoOk(dados.db);
        setConexao('online');
      });
      for (const evento of ['chamada', 'fila']) {
        fonte.addEventListener(evento, (e) => {
          sinal();
          ouvintesRef.current[evento]?.(JSON.parse(e.data));
        });
      }
    };

    abrir();
    vigia = setInterval(() => {
      if (!encerrado && Date.now() - ultimoSinal > 30000) {
        setConexao('offline');
        abrir();
        sinal();
      }
    }, 5000);

    return () => {
      encerrado = true;
      clearInterval(vigia);
      fonte?.close();
    };
  }, []);

  return { conexao, bancoOk };
}
