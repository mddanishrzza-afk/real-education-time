// ============================================================
// Class Context — selected class (6-12), persisted in localStorage
// ============================================================
import { createContext, useContext, useState, useEffect, useMemo } from 'react'

export const CLASS_LEVELS = ['6', '7', '8', '9', '10', '11', '12']

const ClassContext = createContext(null)

export const ClassProvider = ({ children }) => {
  const [classLevel, setClassLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('ret_class')
      return CLASS_LEVELS.includes(saved) ? saved : '8'
    } catch {
      return '8'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ret_class', classLevel)
    } catch {
      /* ignore */
    }
  }, [classLevel])

  const value = useMemo(() => ({ classLevel, setClassLevel }), [classLevel])

  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
}

export const useClass = () => {
  const ctx = useContext(ClassContext)
  if (!ctx) throw new Error('useClass must be used within ClassProvider')
  return ctx
}
