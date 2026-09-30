import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

/** Só renderiza a página se houver sessão com o perfil exigido. */
export default function RotaProtegida({ perfil, exigirGuiche = false, children }) {
  const { usuario } = useAuth();
  const local = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  if (perfil && !usuario.perfis?.[perfil]) {
    return <Navigate to={usuario.perfis?.gestor ? '/gestor' : '/login'} replace />;
  }
  if (exigirGuiche && !usuario.guicheId) return <Navigate to="/login" replace state={{ precisaGuiche: true }} />;
  return children;
}
