import { Header } from '../../components/Header/Header';
import { Greeting } from './Greeting/Greeting';
import { LeftoverCard } from '../../components/LeftoverCard/LeftoverCard';
import { RecommendationsCard } from '../../components/RecommendationsCard/RecommendationsCard';
import { MonthlyMoneyCard } from '../../components/MonthlyMoneyCard/MonthlyMoneyCard';
import { ProgressCard } from '../../components/ProgressCard/ProgressCard';
import { SupportCard } from '../../components/SupportCard/SupportCard';
import { type ProgressPoint } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import './Dashboard.css';
import { DashoboardProvider, useDashboardContext } from './DashboardContext';

/**
 * @TODO - move this business logic to the backend.
 */
function buildProgressNote(points: ProgressPoint[]): string {
  if (points.length < 2) return '';
  const mostRecent = points[0];
  const oldest = points[points.length - 1];
  const delta = mostRecent.disposable_income - oldest.disposable_income;
  if (delta > 0) {
    return `You have ${formatCurrency(delta)} more available each month than you did in ${oldest.period}. That is real progress.`;
  }
  if (delta < 0) {
    return `Your disposable income is ${formatCurrency(Math.abs(delta))} lower than in ${oldest.period}. A free debt adviser may be able to help.`;
  }
  return `Your disposable income has held steady since ${oldest.period}.`;
}

const DashboardContent = () => {
  const { dashboard, pdfRef } = useDashboardContext();

  const progress: ProgressPoint[] | null = dashboard?.overTimeProgress ?? null;
  const money = dashboard?.yourMoneyThisMonth ?? null;
  const recommendations = dashboard?.recommendations ?? [];
  const health = dashboard?.financialHealthStatus ?? null;

  return (
    <div className="home" ref={pdfRef}>
      <Header />
      <main className="home__main">
        <Greeting />
        <div className="home__grid">
          <div className="home__col home__col--primary">
            {health === null ? (
              <article className="leftover-card leftover-card--loading" aria-busy="true">
                Loading your financial health…
              </article>
            ) : (
              <LeftoverCard
                amount={health.disposableIncome}
                status={{ label: health.badgeLabel, tone: health.badgeTone }}
                headline={health.headline}
                body={health.body}
              />
            )}
            {recommendations?.length > 0 ? (
              <RecommendationsCard recommendations={recommendations ?? []} />
            ) : null}
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
            <SupportCard />
          </div>
        </div>
      </main>
    </div>
  );
};

type DashboardProps = {
  shareToken?: string;
};

export function Dashboard({ shareToken }: DashboardProps = {}) {
  return (
    <DashoboardProvider shareToken={shareToken}>
      <DashboardContent />
    </DashoboardProvider>
  );
}
