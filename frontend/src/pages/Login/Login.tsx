import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context'
import { ApiError } from '../../lib/api'
import { useThrowAsyncError } from '../../lib/use-throw-async-error'
import './Login.css'

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const throwAsyncError = useThrowAsyncError()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        throwAsyncError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <main className="login__main">
        <div className="login__brand">Ophelos</div>
        <article className="login__card">
          <header className="login__header">
            <h1 className="login__title">Welcome back</h1>
            <p className="login__sub">Sign in to view your finances.</p>
          </header>
          <form className="login__form" onSubmit={handleSubmit}>
            <label className="login__field">
              <span className="login__label">Email</span>
              <input
                className="login__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="login__field">
              <span className="login__label">Password</span>
              <input
                className="login__input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>
            {error ? (
              <p className="login__error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="login__button" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </article>
      </main>
    </div>
  )
}
