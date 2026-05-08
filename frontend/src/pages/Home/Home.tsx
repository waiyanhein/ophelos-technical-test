import { Header } from '../../components/Header/Header'
import { Greeting } from '../../components/Greeting/Greeting'
import { LeftoverCard } from '../../components/LeftoverCard/LeftoverCard'
import { InsightCard } from '../../components/InsightCard/InsightCard'
import { MonthlyMoneyCard } from '../../components/MonthlyMoneyCard/MonthlyMoneyCard'
import { ProgressCard } from '../../components/ProgressCard/ProgressCard'
import { SupportCard } from '../../components/SupportCard/SupportCard'
import { mockFinances } from '../../data/mockFinances'
import './Home.css'

export function Home() {
  const data = mockFinances

  return (
    <div className="home">
      <Header period={data.period} email={data.user.email} />
      <main className="home__main">
        <Greeting firstName={data.user.firstName} />
        <div className="home__grid">
          <div className="home__col home__col--primary">
            <LeftoverCard
              amount={data.leftover}
              status={data.status}
              headline={data.headline}
              body={data.body}
            />
            <InsightCard body={data.insight} />
            <MonthlyMoneyCard data={data.money} />
          </div>
          <div className="home__col home__col--secondary">
            <ProgressCard months={data.progress} note={data.progressNote} />
            <SupportCard intro={data.support.intro} links={data.support.links} />
          </div>
        </div>
      </main>
    </div>
  )
}
