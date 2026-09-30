import { useId } from 'react';

/** Rótulo + controle de formulário, com ligação acessível entre os dois. */
export default function Campo({ rotulo, ajuda, children }) {
  const id = useId();
  const controle = typeof children === 'function' ? children(id) : children;
  return (
    <div className="campo">
      <label className="campo__rotulo" htmlFor={id}>{rotulo}</label>
      {controle}
      {ajuda && <small className="campo__ajuda">{ajuda}</small>}
    </div>
  );
}
