import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { PublicOnlyRoute } from './components/PublicOnlyRoute/PublicOnlyRoute'
import { Index } from './pages/Index/Index'
import { Login } from './pages/Login/Login'
import { Home } from './pages/Home/Home'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
