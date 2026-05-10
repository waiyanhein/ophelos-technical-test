import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import './Index.css';

export function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    navigate(user ? '/dashboard' : '/login', { replace: true });
  }, [navigate, user]);

  return (
    <div className="index">
      <div className="index__spinner" aria-label="Loading" role="status" />
    </div>
  );
}
