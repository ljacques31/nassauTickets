import Campo from './Campo.jsx';

/** Escolha entre relatório diário (data) e mensal (mês). Componente controlado. */
export default function SeletorPeriodo({ valor, aoMudar }) {
  const alterar = (parcial) => aoMudar({ ...valor, ...parcial });
  return (
    <fieldset className="seletor-periodo">
      <legend className="sr-only">Período do relatório</legend>
      <div className="alternador" role="radiogroup" aria-label="Tipo de período">
        {[['dia', 'Diário'], ['mes', 'Mensal']].map(([chave, rotulo]) => (
          <label key={chave} className={`alternador__opcao ${valor.periodo === chave ? 'ativo' : ''}`}>
            <input type="radio" name="periodo" value={chave} checked={valor.periodo === chave}
              onChange={() => alterar({ periodo: chave })} />
            {rotulo}
          </label>
        ))}
      </div>
      {valor.periodo === 'dia' ? (
        <Campo rotulo="Data">
          {(id) => <input id={id} type="date" value={valor.data} onChange={(e) => alterar({ data: e.target.value })} required />}
        </Campo>
      ) : (
        <Campo rotulo="Mês">
          {(id) => <input id={id} type="month" value={valor.mes} onChange={(e) => alterar({ mes: e.target.value })} required />}
        </Campo>
      )}
    </fieldset>
  );
}
