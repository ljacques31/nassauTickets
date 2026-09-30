import { Navigate, Route, Routes } from 'react-router-dom';
import RotaProtegida from './components/RotaProtegida.jsx';
import Atendente from './pages/Atendente.jsx';
import Inicio from './pages/Inicio.jsx';
import Login from './pages/Login.jsx';
import Painel from './pages/Painel.jsx';
import Totem from './pages/Totem.jsx';
import Configuracoes from './pages/gestor/Configuracoes.jsx';
import Desempenho from './pages/gestor/Desempenho.jsx';
import Gestor from './pages/gestor/Gestor.jsx';
import Guiches from './pages/gestor/Guiches.jsx';
import Relatorios from './pages/gestor/Relatorios.jsx';
import Usuarios from './pages/gestor/Usuarios.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/totem" element={<Totem />} />
      <Route path="/painel" element={<Painel />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/atendente"
        element={<RotaProtegida perfil="atendente" exigirGuiche><Atendente /></RotaProtegida>}
      />
      <Route path="/gestor" element={<RotaProtegida perfil="gestor"><Gestor /></RotaProtegida>}>
        <Route index element={<Navigate to="relatorios" replace />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="desempenho" element={<Desempenho />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="guiches" element={<Guiches />} />
        <Route path="expediente" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
