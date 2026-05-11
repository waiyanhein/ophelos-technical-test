import { useParams } from 'react-router-dom';
import { Dashboard } from '../Dashboard/Dashboard';

export function SharableStatement() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return <p>Invalid sharable statement link.</p>;
  }

  return <Dashboard shareToken={token} />;
}
