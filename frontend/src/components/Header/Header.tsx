import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context'
import './Header.css'

type Props = {
  period: string
  email: string
}

export function Header({ period, email }: Props) {
  const navigate = useNavigate()
  const { logout } = useAuth()

  function handleSignOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a href="/" className="site-header__brand">
          Ophelos
        </a>
        <nav className="site-header__meta">
          <span className="site-header__period">{period}</span>
          <span className="site-header__email">{email}</span>
          <button type="button" className="site-header__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  )
}
