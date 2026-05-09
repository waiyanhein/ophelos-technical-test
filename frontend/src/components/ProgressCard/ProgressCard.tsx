import { formatCurrency } from '../../lib/format'
import type { ProgressPoint } from '../../lib/api'
import './ProgressCard.css'

type Props = {
  points: ProgressPoint[]
  note?: string
}

type Bucket = 'success' | 'warning' | 'danger'

function bucketFromProgress(progress: number): Bucket {
  if (progress >= 65) return 'success'
  if (progress >= 30) return 'warning'
  return 'danger'
}

function shortMonth(period: string): string {
  return period.split(' ')[0]
}

export function ProgressCard({ points, note }: Props) {
  const monthCount = points.length

  return (
    <article className="progress-card">
      <h3 className="progress-card__eyebrow">
        Your progress over {monthCount} {monthCount === 1 ? 'month' : 'months'}
      </h3>
      <ul className="progress-card__rows">
        {points.map((point) => {
          const bucket = bucketFromProgress(point.progress)
          const width = Math.max(8, point.progress)
          return (
            <li className="progress-card__row" key={point.period}>
              <span className="progress-card__month">{shortMonth(point.period)}</span>
              <span className="progress-card__track" aria-hidden="true">
                <span
                  className={`progress-card__fill progress-card__fill--${bucket}`}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="progress-card__amount">
                {formatCurrency(point.disposable_income)}
              </span>
              {point.is_now ? <span className="progress-card__now">now</span> : <span />}
            </li>
          )
        })}
      </ul>
      {note ? (
        <>
          <div className="progress-card__divider" aria-hidden="true" />
          <p className="progress-card__note">{note}</p>
        </>
      ) : null}
    </article>
  )
}
