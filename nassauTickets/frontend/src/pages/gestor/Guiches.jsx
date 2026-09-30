import { useEffect, useState } from 'react';
import Botao from '../../components/Botao.jsx';
import Campo from '../../components/Campo.jsx';
import Mensagem from '../../components/Mensagem.jsx';
import Tabela from '../../components/Tabela.jsx';
import { useRequisicao } from '../../hooks/useRequisicao.js';
import { api } from '../../services/api.js';

const VAZIO = { id: null, numero: '', descricao: '', ativo: true };

export default function Guiches() {
  const requisitar = useRequisicao();
  const [guiches, setGuiches] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mensagem, setMensagem] = useState(null);

  const carregar = () => requisitar(api.gestor.guiches).then(setGuiches)
    .catch((e) => setMensagem({ tipo: 'erro', texto: e.message }));
  useEffect(() => { carregar(); }, []);

  const alterar = (e) => {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  async function salvar(e) {
    e.preventDefault();
    setMensagem(null);
    try {
      const dados = { numero: Number(form.numero), descricao: form.descricao, ativo: form.ativo };
      if (form.id) await requisitar((t) => api.gestor.atualizarGuiche(t, form.id, dados));
      else await requisitar((t) => api.gestor.criarGuiche(t, dados));
      setMensagem({ tipo: 'sucesso', texto: 'Guichê salvo.' });
      setForm(VAZIO);
      carregar();
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: erro.message });
    }
  }

  return (
    <section aria-labelledby="titulo-guiches">
      <div className="cabecalho-secao"><h1 id="titulo-guiches">Guichês</h1></div>
      <Mensagem tipo={mensagem?.tipo} aoFechar={() => setMensagem(null)}>{mensagem?.texto}</Mensagem>
      <div className="duas-colunas">
        <Tabela
          legenda="Guichês cadastrados"
          chave="id"
          linhas={guiches}
          colunas={[
            { titulo: 'Número', campo: 'numero', alinhar: 'direita' },
            { titulo: 'Descrição', campo: 'descricao' },
            { titulo: 'Atendente no guichê', render: (g) => g.ocupante || 'Livre' },
            { titulo: 'Situação', render: (g) => (g.ativo ? 'Ativo' : 'Inativo') },
            { titulo: 'Ação', render: (g) => <Botao variante="discreto" onClick={() => setForm({ ...g, descricao: g.descricao || '' })}>Editar</Botao> },
          ]}
        />
        <form className="cartao formulario" onSubmit={salvar}>
          <h2 className="cartao__titulo">{form.id ? `Editar guichê ${form.numero}` : 'Novo guichê'}</h2>
          <Campo rotulo="Número">
            {(id) => <input id={id} name="numero" type="number" min="1" max="999" value={form.numero} onChange={alterar} required />}
          </Campo>
          <Campo rotulo="Descrição">
            {(id) => <input id={id} name="descricao" value={form.descricao} onChange={alterar} maxLength={60} />}
          </Campo>
          {form.id && (
            <label className="marcacao"><input type="checkbox" name="ativo" checked={form.ativo} onChange={alterar} /> Ativo</label>
          )}
          <div className="formulario__acoes">
            <Botao type="submit">{form.id ? 'Salvar alterações' : 'Cadastrar guichê'}</Botao>
            {form.id && <Botao variante="discreto" onClick={() => setForm(VAZIO)}>Cancelar</Botao>}
          </div>
        </form>
      </div>
    </section>
  );
}
