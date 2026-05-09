import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { loginRequest } from './api'
import {
  clearStoredUser,
  clearToken,
  getStoredUser,
  setStoredUser,
  setToken,
  type User,
} from './auth'

type AuthContextValue = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())

  const login = useCallback(async (email: string, password: string) => {
    const { authToken, user: authenticatedUser } = await loginRequest(email, password)
    const nextUser: User = authenticatedUser
    setToken(authToken)
    setStoredUser(nextUser)
    setUser(nextUser)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    clearStoredUser()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
