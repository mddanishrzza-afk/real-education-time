// ============================================================
// Navbar, Footer and App Layout
// ============================================================
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import ClassSelector from './ClassSelector'

export function Navbar() {
  const { t, lang, setLang } = useLanguage()
  const { theme, toggle } = useTheme()
  const { isAuthenticated, isAdmin, isTeacher, userData, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const role = isAdmin ? 'admin' : isTeacher ? 'teacher' : 'student'

  const links = [
    { to: '/', label: t('home') },
    { to: '/learn', label: t('learn') },
    { to: '/subjects', label: t('subjects') },
    { to: '/leaderboard', label: t('leaderboard') },
    { to: '/certificates', label: t('certificates') },
    { to: '/about', label: t('about') },
  ]
  if (isAuthenticated) {
    links.push(
      { to: '/dashboard', label: t('dashboard') },
      { to: '/profile', label: t('profile') }
    )
    if (role === 'teacher') links.push({ to: '/teacher', label: t('teacherDashboard') })
    if (role === 'admin') links.push({ to: '/admin', label: t('adminDashboard') })
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const close = () => setOpen(false)

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={close}>
          <div className="logo">🎓</div>
          <div className="logo-text">
            REAL EDUCATION TIME
            <small>{t('tagline')}</small>
          </div>
        </Link>

        <nav className="nav-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          {/* Class selector */}
          <ClassSelector compact />

          {/* Language switch */}
          <button
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="btn btn-outline btn-sm"
            title="Switch language"
          >
            {lang === 'en' ? 'हिंदी' : 'English'}
          </button>

          {/* Theme toggle */}
          <button className="btn btn-outline btn-sm" onClick={toggle} aria-label="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {isAuthenticated ? (
            <>
              <Link to="/profile" className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                {(userData?.name || 'S').charAt(0).toUpperCase()}
              </Link>
              <button className="btn btn-danger btn-sm" onClick={handleLogout}>
                <span className="btn-label">{t('logout')}</span>↪
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">{t('login')}</Link>
              <Link to="/register" className="btn btn-primary btn-sm">{t('register')}</Link>
            </>
          )}

          <button className="hamburger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>

      <div className={`mobile-nav ${open ? 'open' : ''}`}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} onClick={close} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
        {isAuthenticated && (
          <button className="btn btn-danger btn-block mt-3" onClick={() => { handleLogout(); close(); }}>
            {t('logout')}
          </button>
        )}
      </div>
    </header>
  )
}

export function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="brand">
          <div className="logo">🎓</div>
          <div>
            <div style={{ fontWeight: 800 }}>REAL EDUCATION TIME</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tagline')}</div>
          </div>
        </div>
        <p>{t('footerText')}</p>
      </div>
    </footer>
  )
}

export default function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </>
  )
}
