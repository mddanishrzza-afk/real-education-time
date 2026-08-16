// ============================================================
// Certificates page
// ============================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getCertificatesForUser } from '../services/store'
import { generateCertificatePDF } from '../services/certificate'
import { formatDate } from '../utils/helpers'
import { Spinner, EmptyState } from '../components/ui'

export default function Certificates() {
  const { userData } = useAuth()
  const { t } = useLanguage()
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)

  const userId = userData?.uid || 'demo-user'

  useEffect(() => {
    getCertificatesForUser(userId)
      .then(setCerts)
      .catch((err) => { console.error('Certificates load error:', err); setCerts([]) })
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <Spinner />

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading">
        <h1>{t('certificates')}</h1>
        <p>{t('certificatesEarned')}: {certs.length}</p>
      </div>

      {certs.length === 0 ? (
        <EmptyState
          emoji="🎖️"
          title={t('noCertificates')}
          sub={<Link to="/quiz" className="btn btn-primary mt-2">{t('takeAQuiz')}</Link>}
        />
      ) : (
        <div className="grid grid-2">
          {certs.map((c) => (
            <div key={c.id} className="card">
              <div className="cert-preview">
                <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700, color: '#10477b' }}>
                  REAL EDUCATION TIME
                </div>
                <h3 style={{ fontSize: 18, color: '#b37c00', margin: '6px 0' }}>{t('certificateOfAchievement')}</h3>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10477b' }}>{c.userName}</div>
                <p style={{ color: '#555', fontSize: 14 }}>{c.quizName}</p>
                <p style={{ color: '#555', fontSize: 13, marginTop: 6 }}>
                  {t('score')}: {c.score} | {t('percentage')}: {c.percentage}% | {t('grade')}: {c.grade}
                </p>
                <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                  {t('date')}: {formatDate(c.date || c.createdAt)} • {c.id}
                </p>
              </div>
              <button
                className="btn btn-primary btn-block mt-2"
                onClick={() =>
                  generateCertificatePDF({
                    studentName: c.userName,
                    quizName: c.quizName,
                    score: c.score,
                    percentage: c.percentage,
                    grade: c.grade,
                    certId: c.id,
                    date: c.date || c.createdAt || new Date(),
                  })
                }
              >
                ⬇ {t('downloadPdf')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
