import './Header.css'

type Props = {
  period: string
  email: string
  onSignOut?: () => void
}

export function Header({ period, email, onSignOut }: Props) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a href="/" className="site-header__brand">
          Ophelos
        </a>
        <nav className="site-header__meta">
          <span className="site-header__period">{period}</span>
          <span className="site-header__email">{email}</span>
          <button type="button" className="site-header__signout" onClick={onSignOut}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  )
}
