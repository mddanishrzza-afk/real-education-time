// ============================================================
// Student Dashboard — stats, charts, recent quizzes
// ============================================================
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getResultsForUser, getCertificatesForUser } from '../services/store'
import { Spinner, EmptyState, StatCard } from '../components/ui'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend)

export default function Dashboard() {
  const { userData } = useAuth()
  const { t } = useLanguage()
  const [results, setResults] = useState([])
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartTheme, setChartTheme] = useState('light')

  const userId = userData?.uid || 'demo-user'

  useEffect(() => {
    ;(async () => {
      try {
        const r = await getResultsForUser(userId)
        const c = await getCertificatesForUser(userId)
        setResults(r)
        setCerts(c)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    })()
    // detect theme for chart colors
    const apply = () => setChartTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    apply()
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true })
    return () => obs.disconnect()
  }, [userId])

  if (loading) return <Spinner />

  const completed = results.length
  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
    : 0
  const best = results.length ? Math.max(...results.map((r) => r.percentage)) : 0

  const axisColor = chartTheme === 'dark' ? '#93a0bd' : '#67728a'
  const gridColor = chartTheme === 'dark' ? '#26304a' : '#e5eaf2'

  // Subject performance
  const subjMap = {}
  results.forEach((r) => {
    subjMap[r.subjectId || r.quizTitle] = subjMap[r.subjectId || r.quizTitle] || { total: 0, n: 0 }
    subjMap[r.subjectId || r.quizTitle].total += r.percentage
    subjMap[r.subjectId || r.quizTitle].n++
  })
  const subjLabels = Object.keys(subjMap)
  const subjData = subjLabels.map((k) => Math.round(subjMap[k].total / subjMap[k].n))

  const scoreLabels = results.map((_, i) => `#${i + 1}`).reverse()
  const scoreData = [...results].reverse().map((r) => r.percentage)

  const barData = {
    labels: subjLabels,
    datasets: [{ label: 'Avg %', data: subjData, backgroundColor: '#2563eb', borderRadius: 8 }],
  }
  const lineData = {
    labels: scoreLabels,
    datasets: [{
      label: 'Score %', data: scoreData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.15)',
      fill: true, tension: 0.4, pointBackgroundColor: '#f59e0b',
    }],
  }
  const chartOpts = {
    responsive: true,
    plugins: { legend: { labels: { color: axisColor } } },
    scales: {
      x: { ticks: { color: axisColor }, grid: { color: gridColor } },
      y: { ticks: { color: axisColor }, grid: { color: gridColor }, min: 0, max: 100 },
    },
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-heading flex justify-between items-center wrap">
        <div>
          <h1>{t('welcomeBackStudent')}</h1>
          <p>{userData?.name} • {userData?.email}</p>
        </div>
        <Link to="/quiz" className="btn btn-accent">{t('startQuiz')}</Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-4">
        <StatCard icon="✅" num={completed} label={t('quizzesCompleted')} />
        <StatCard icon="📊" num={`${avg}%`} label={t('averageScore')} />
        <StatCard icon="🏅" num={`${best}%`} label={t('bestScore')} />
        <StatCard icon="🎖️" num={certs.length} label={t('certificatesEarned')} />
      </div>

      {results.length === 0 ? (
        <EmptyState
          emoji="📝"
          title={t('noAttemptsYet')}
          sub={<Link to="/quiz" className="btn btn-primary mt-2">{t('takeAQuiz')}</Link>}
        />
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-2 mt-4">
            {subjLabels.length > 0 && (
              <div className="card">
                <h3 className="mb-3">{t('subjectPerformance')}</h3>
                <Bar data={barData} options={chartOpts} />
              </div>
            )}
            {scoreLabels.length > 0 && (
              <div className="card">
                <h3 className="mb-3">{t('scoreHistory')}</h3>
                <Line data={lineData} options={chartOpts} />
              </div>
            )}
          </div>

          {/* Recent quizzes */}
          <div className="card mt-4">
            <h3 className="mb-3">{t('recentQuizzes')}</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('quizTitle')}</th>
                    <th>{t('score')}</th>
                    <th>{t('percentage')}</th>
                    <th>{t('grade')}</th>
                    <th>{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 6).map((r) => (
                    <tr key={r.id}>
                      <td>{r.quizTitle}</td>
                      <td>{r.score}/{r.total}</td>
                      <td>{r.percentage}%</td>
                      <td><span className={`badge ${r.grade === 'A' ? 'badge-success' : r.grade === 'B' ? 'badge-accent' : 'badge-danger'}`}>{r.grade}</span></td>
                      <td>{new Date(r.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
