import { NOMES_TIPO, partesCodigo } from '../utils/formatadores.js';

/**
 * Canhoto de senha: o elemento visual central do sistema.
 * Aparece no painel, no totem (senha impressa) e na tela do atendente.
 * A faixa lateral tem a cor do tipo (SP vinho, SE verde, SG azul).
 */
export default function Canhoto({ codigo, tipo, tamanho = 'medio', destaque, children }) {
  const { data, seq } = partesCodigo(codigo);
  const t = tipo || partesCodigo(codigo).tipo;
  return (
    <div className={`canhoto canhoto--${tamanho} canhoto--${t}`}>
      <div className="canhoto__faixa" aria-hidden="true">{t}</div>
      <div className="canhoto__corpo">
        <span className="canhoto__tipo">{NOMES_TIPO[t]}</span>
        <span className="canhoto__codigo" aria-label={`Senha ${t} ${seq}`}>
          <span className="canhoto__prefixo">{t}</span>
          <span className="canhoto__seq">{seq}</span>
        </span>
        <span className="canhoto__completo">{data}-{t}{seq}</span>
        {children}
      </div>
      {destaque && <div className="canhoto__destaque">{destaque}</div>}
    </div>
  );
}
