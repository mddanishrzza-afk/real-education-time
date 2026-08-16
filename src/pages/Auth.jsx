// ============================================================
// Login, Register, Forgot Password
// ============================================================
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { friendlyError } from '../utils/helpers'
import { Alert } from '../components/ui'

const authCard = {
  maxWidth: 460,
  margin: '40px auto',
  padding: '34px',
}

export function Login() {
  const { t } = useLanguage()
  const { login, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError(t('selectAnAnswer')); return }
    setLoading(true)
    try {
      await login(email, password)
      navigate(location.state?.from || '/dashboard')
    } catch (err) {
      console.error('Login error:', err?.code || err)
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={authCard}>
        <div className="text-center mb-3">
          <div className="logo" style={{ margin: '0 auto' }}>🎓</div>
          <h1 style={{ fontSize: 26, marginTop: 12 }}>{t('login')}</h1>
        </div>
        {!isConfigured && <Alert type="info">{t('setupModeMsg')}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>{t('password')}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="flex justify-between items-center mt-2">
            <Link to="/forgot-password" style={{ color: 'var(--primary)', fontSize: 13.5 }}>{t('forgotPassword')}</Link>
          </div>
          <button className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
            {loading ? t('loading') : t('login')}
          </button>
        </form>
        <p className="text-center mt-3" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {t('noQuizzesAvailable') ? 'Don\'t have an account?' : ''}{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('register')}</Link>
        </p>
      </div>
    </div>
  )
}

export function Register() {
  const { t } = useLanguage()
  const { register, isConfigured } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) { setError('Please fill all fields.'); return }
    if (password !== confirm) { setError(t('confirmPassword') + ' mismatch'); return }
    setLoading(true)
    try {
      await register({ name, email, password })
      navigate('/dashboard')
    } catch (err) {
      console.error('Register error:', err?.code || err)
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={authCard}>
        <div className="text-center mb-3">
          <div className="logo" style={{ margin: '0 auto' }}>🎓</div>
          <h1 style={{ fontSize: 26, marginTop: 12 }}>{t('register')}</h1>
        </div>
        {!isConfigured && <Alert type="info">{t('setupModeMsg')}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('fullName')}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
          </div>
          <div className="field">
            <label>{t('email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>{t('password')}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="field">
            <label>{t('confirmPassword')}</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
            {loading ? t('loading') : t('register')}
          </button>
        </form>
        <p className="text-center mt-3" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('login')}</Link>
        </p>
      </div>
    </div>
  )
}

export function ForgotPassword() {
  const { t } = useLanguage()
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setMsg('')
    setLoading(true)
    try {
      await resetPassword(email)
      setMsg(t('resetLinkSent'))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={authCard}>
        <div className="text-center mb-3">
          <h1 style={{ fontSize: 26 }}>{t('resetPassword')}</h1>
        </div>
        {msg && <Alert type="success">{msg}</Alert>}
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button className="btn btn-primary btn-block mt-3" disabled={loading}>
            {loading ? t('loading') : t('sendResetLink')}
          </button>
        </form>
        <p className="text-center mt-3">
          <Link to="/login" style={{ color: 'var(--primary)', fontSize: 14 }}>{t('back')}</Link>
        </p>
      </div>
    </div>
  )
}
