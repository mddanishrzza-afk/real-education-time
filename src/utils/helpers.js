// ============================================================
// General utility helpers
// ============================================================

// Format seconds as MM:SS
export const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Generate a unique-ish ID for local/sample records
export const uid = (prefix = '') => {
  return (
    prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
  )
}

// Clamp a number between min and max
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

// Percentage helper
export const percent = (obtained, total) => {
  if (!total) return 0
  return Math.round((obtained / total) * 100)
}

// Date formatter to a readable string (e.g. 15 Aug 2026)
export const formatDate = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Get a readable, safe error message from a Firebase error
export const friendlyError = (err) => {
  if (!err) return 'Something went wrong'
  const code = err.code || ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/operation-not-allowed':
      return 'Email/Password login is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.'
    default:
      return 'Something went wrong'
  }
}

// Shuffle an array (used for options if desired)
export const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
