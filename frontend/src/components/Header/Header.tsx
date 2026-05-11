import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import './Header.css';

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/dashboard" className="site-header__brand">
          Ophelos
        </Link>
        <nav className="site-header__meta">
          <span className="site-header__email">{user?.email ?? ''}</span>
          <button type="button" className="site-header__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
