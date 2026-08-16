// ============================================================
// Language Context — Hindi / English switching
// Persisted in localStorage
// ============================================================
import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { getText } from '../i18n/translations'

const LanguageContext = createContext(null)

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('ret_lang') || 'en'
    } catch {
      return 'en'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ret_lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key) => getText(lang, key),
    }),
    [lang]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
