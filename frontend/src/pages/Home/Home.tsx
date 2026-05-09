import { useEffect, useState } from 'react'
import { Header } from '../../components/Header/Header'
import { Greeting } from '../../components/Greeting/Greeting'
import { LeftoverCard } from '../../components/LeftoverCard/LeftoverCard'
import { InsightCard } from '../../components/InsightCard/InsightCard'
import { MonthlyMoneyCard } from '../../components/MonthlyMoneyCard/MonthlyMoneyCard'
import { ProgressCard } from '../../components/ProgressCard/ProgressCard'
import { SupportCard } from '../../components/SupportCard/SupportCard'
import { mockFinances } from '../../data/mockFinances'
import { useAuth } from '../../lib/auth-context'
import { fetchDashboard, type Dashboard, type ProgressPoint } from '../../lib/api'
import { formatCurrency } from '../../lib/format'
import { useThrowAsyncError } from '../../lib/use-throw-async-error'
import './Home.css'

function buildProgressNote(points: ProgressPoint[]): string {
  if (points.length < 2) return ''
  const mostRecent = points[0]
  const oldest = points[points.length - 1]
  const delta = mostRecent.disposable_income - oldest.disposable_income
  if (delta > 0) {
    return `You have ${formatCurrency(delta)} more available each month than you did in ${oldest.period}. That is real progress.`
  }
  if (delta < 0) {
    return `Your disposable income is ${formatCurrency(Math.abs(delta))} lower than in ${oldest.period}. A free debt adviser may be able to help.`
  }
  return `Your disposable income has held steady since ${oldest.period}.`
}

export function Home() {
  const data = mockFinances
  const { user } = useAuth()
  const firstName = user?.name.trim().split(/\s+/)[0] ?? ''
  const email = user?.email ?? ''
  const throwAsync = useThrowAsyncError()

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data)
      })
      .catch((error: unknown) => {
        if (!cancelled) throwAsync(error)
      })
    return () => {
      cancelled = true
    }
  }, [throwAsync])

  const progress: ProgressPoint[] | null = dashboard?.overTimeProgress ?? null
  const money = dashboard?.yourMoneyThisMonth ?? null

  return (
    <div className="home">
      <Header period={data.period} email={email} />
      <main className="home__main">
        <Greeting firstName={firstName} />
        <div className="home__grid">
          <div className="home__col home__col--primary">
            <LeftoverCard
              amount={data.leftover}
              status={data.status}
              headline={data.headline}
              body={data.body}
            />
            <InsightCard body={data.insight} />
            {money === null ? (
              <article className="money-card money-card--loading" aria-busy="true">
                Loading your money this month…
              </article>
            ) : (
              <MonthlyMoneyCard data={money} />
            )}
          </div>
          <div className="home__col home__col--secondary">
            {progress === null ? (
              <article className="progress-card progress-card--loading" aria-busy="true">
                Loading your progress…
              </article>
            ) : (
              <ProgressCard points={progress} note={buildProgressNote(progress)} />
            )}
            <SupportCard intro={data.support.intro} links={data.support.links} />
          </div>
        </div>
      </main>
    </div>
  )
}
