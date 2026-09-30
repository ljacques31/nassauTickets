import { useEffect, useState } from 'react';
import Botao from '../../components/Botao.jsx';
import Campo from '../../components/Campo.jsx';
import Mensagem from '../../components/Mensagem.jsx';
import Tabela from '../../components/Tabela.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useRequisicao } from '../../hooks/useRequisicao.js';
import { api } from '../../services/api.js';

const VAZIO = { id: null, nome: '', login: '', senha: '', perfilAtendente: true, perfilGestor: false, ativo: true };

export default function Usuarios() {
  const requisitar = useRequisicao();
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [mensagem, setMensagem] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => requisitar(api.gestor.usuarios).then(setUsuarios)
    .catch((e) => setMensagem({ tipo: 'erro', texto: e.message }));
  useEffect(() => { carregar(); }, []);

  const alterar = (e) => {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const { id, ...dados } = form;
      if (!dados.senha) delete dados.senha;
      if (id) await requisitar((t) => api.gestor.atualizarUsuario(t, id, dados));
      else await requisitar((t) => api.gestor.criarUsuario(t, dados));
      setMensagem({ tipo: 'sucesso', texto: id ? 'Atendente atualizado.' : 'Atendente cadastrado.' });
      setForm(VAZIO);
      carregar();
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: erro.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-labelledby="titulo-usuarios">
      <div className="cabecalho-secao"><h1 id="titulo-usuarios">Atendentes</h1></div>
      <Mensagem tipo={mensagem?.tipo} aoFechar={() => setMensagem(null)}>{mensagem?.texto}</Mensagem>
      <div className="duas-colunas">
        <Tabela
          legenda="Atendentes cadastrados"
          chave="id"
          linhas={usuarios}
          vazio="Nenhum atendente cadastrado."
          colunas={[
            { titulo: 'Nome', campo: 'nome' },
            { titulo: 'Usuário', campo: 'login' },
            { titulo: 'Perfis', render: (u) => [u.perfilAtendente && 'Atendente', u.perfilGestor && 'Gestor'].filter(Boolean).join(' e ') },
            { titulo: 'Situação', render: (u) => (u.ativo ? 'Ativo' : 'Inativo') },
            { titulo: 'Ação', render: (u) => <Botao variante="discreto" onClick={() => setForm({ ...u, senha: '' })}>Editar</Botao> },
          ]}
        />
        <form className="cartao formulario" onSubmit={salvar}>
          <h2 className="cartao__titulo">{form.id ? `Editar ${form.nome}` : 'Novo atendente'}</h2>
          <Campo rotulo="Nome completo">
            {(id) => <input id={id} name="nome" value={form.nome} onChange={alterar} required minLength={3} />}
          </Campo>
          <Campo rotulo="Usuário de acesso" ajuda="Letras minúsculas, números, ponto, hífen ou sublinhado.">
            {(id) => <input id={id} name="login" value={form.login} onChange={alterar} required pattern="[a-z0-9._-]{3,50}" />}
          </Campo>
          <Campo rotulo={form.id ? 'Nova senha (deixe em branco para manter)' : 'Senha'} ajuda="Mínimo de 6 caracteres.">
            {(id) => <input id={id} name="senha" type="password" autoComplete="new-password" value={form.senha}
              onChange={alterar} required={!form.id} minLength={6} />}
          </Campo>
          <fieldset className="grupo-marcacao">
            <legend>Perfis</legend>
            <label><input type="checkbox" name="perfilAtendente" checked={form.perfilAtendente} onChange={alterar} /> Atendente</label>
            <label><input type="checkbox" name="perfilGestor" checked={form.perfilGestor} onChange={alterar}
              disabled={form.id === usuario.sub} /> Gestor (cadastros e relatórios)</label>
            {form.id && (
              <label><input type="checkbox" name="ativo" checked={form.ativo} onChange={alterar}
                disabled={form.id === usuario.sub} /> Ativo</label>
            )}
          </fieldset>
          <div className="formulario__acoes">
            <Botao type="submit" carregando={salvando}>{form.id ? 'Salvar alterações' : 'Cadastrar atendente'}</Botao>
            {form.id && <Botao variante="discreto" onClick={() => setForm(VAZIO)}>Cancelar</Botao>}
          </div>
        </form>
      </div>
    </section>
  );
}
