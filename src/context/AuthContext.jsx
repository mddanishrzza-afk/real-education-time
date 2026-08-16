// ============================================================
// Auth Context
// Uses REAL Firebase Authentication when configured.
// When Firebase is NOT configured yet, a clearly-labelled
// "demo mode" (localStorage) fallback lets you test the UI.
// Demo mode is temporary — switch to real config in .env for
// production. Passwords are NEVER stored in demo or Firestore.
// ============================================================
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isConfigured } from '../firebase/firebase'

const AuthContext = createContext(null)

// ---- Demo mode helpers (only when Firebase not configured) ----
const DEMO_KEY = 'ret_demo_user'

function loadDemoUser() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY))
  } catch {
    return null
  }
}
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  // ---------- REAL FIREBASE path ----------
  useEffect(() => {
    let unsub = null
    let done = false
    const finish = (u, ud) => {
      if (done) return
      done = true
      setUser(u)
      setUserData(ud)
      setLoading(false)
    }

    if (!isConfigured || !auth) {
      // Use demo mode fallback
      const demo = loadDemoUser()
      finish(demo, demo)
      return
    }

    try {
      unsub = onAuthStateChanged(
        auth,
        async (fbUser) => {
          if (fbUser) {
            try {
              const snap = await getDoc(doc(db, 'users', fbUser.uid))
              if (snap.exists()) {
                finish(fbUser, snap.data())
              } else {
                finish(fbUser, {
                  uid: fbUser.uid,
                  name: fbUser.displayName || 'Student',
                  email: fbUser.email,
                  role: 'student',
                  language: 'en',
                })
              }
            } catch (err) {
              console.error('Error loading user doc', err)
              finish(fbUser, { uid: fbUser.uid, name: fbUser.displayName || 'Student', email: fbUser.email, role: 'student', language: 'en' })
            }
          } else {
            finish(null, null)
          }
        },
        (err) => {
          // auth listener error (e.g. network blocked in sandbox) — never white-screen
          console.error('Auth listener error', err)
          const demo = loadDemoUser()
          finish(demo, demo)
        }
      )
      // safety timeout so the app never hangs on loading
      const timer = setTimeout(() => {
        if (!done) {
          console.warn('Auth listener timed out — falling back to demo mode')
          const demo = loadDemoUser()
          finish(demo, demo)
        }
      }, 8000)
      return () => {
        clearTimeout(timer)
        if (unsub) unsub()
      }
    } catch (err) {
      console.error('Auth init error — falling back', err)
      const demo = loadDemoUser()
      finish(demo, demo)
      return
    }
  }, [])

  // ---------- Register ----------
  const register = useCallback(
    async ({ name, email, password }) => {
      if (!isConfigured || !auth || !db) {
        // Demo mode register
        if (loadDemoUser()) {
          throw new Error('demo/exists')
        }
        const demoUser = { uid: 'demo-' + Date.now(), name, email, role: 'student', language: 'en' }
        localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser))
        setUser(demoUser)
        setUserData(demoUser)
        return demoUser
      }
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      // Save profile (never the password)
      const profile = {
        uid: cred.user.uid,
        name,
        email,
        role: 'student',
        language: 'en',
        createdAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'users', cred.user.uid), profile)
      setUser(cred.user)
      setUserData(profile)
      return cred.user
    },
    []
  )

  // ---------- Login ----------
  const login = useCallback(
    async (email, password) => {
      if (!isConfigured || !auth) {
        // Demo mode login: accept the demo user created via register
        const demoUser = loadDemoUser()
        if (demoUser && demoUser.email === email) {
          setUser(demoUser)
          setUserData(demoUser)
          return demoUser
        }
        throw new Error('auth/user-not-found')
      }
      return signInWithEmailAndPassword(auth, email, password)
    },
    []
  )

  // ---------- Logout ----------
  const logout = useCallback(async () => {
    if (!isConfigured || !auth) {
      localStorage.removeItem(DEMO_KEY)
      setUser(null)
      setUserData(null)
      return
    }
    await signOut(auth)
    setUser(null)
    setUserData(null)
  }, [])

  // ---------- Reset password ----------
  const resetPassword = useCallback(
    async (email) => {
      if (!isConfigured || !auth) {
        return // demo has no email service
      }
      return sendPasswordResetEmail(auth, email)
    },
    []
  )

  // ---------- Update profile ----------
  const updateProfileData = useCallback(
    async (data) => {
      setUserData((prev) => ({ ...(prev || {}), ...data }))
      setUser((prev) => ({ ...(prev || {}), ...data }))
      if (isConfigured && db) {
        const uid = user?.uid || (userData?.uid)
        if (uid) {
          await setDoc(doc(db, 'users', uid), { ...(userData || {}), ...data }, { merge: true })
        }
      } else {
        const demoUser = loadDemoUser()
        if (demoUser) {
          const updated = { ...demoUser, ...data }
          localStorage.setItem(DEMO_KEY, JSON.stringify(updated))
        }
      }
    },
    [user, userData]
  )

  const value = useMemo(
    () => ({
      user,
      userData,
      isAuthenticated: !!user,
      loading,
      register,
      login,
      logout,
      resetPassword,
      updateProfileData,
      isConfigured,
      // role helpers
      role: userData?.role || 'student',
      isStudent: (userData?.role || 'student') === 'student',
      isTeacher: userData?.role === 'teacher',
      isAdmin: userData?.role === 'admin',
    }),
    [user, userData, loading, register, login, logout, resetPassword, updateProfileData]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
