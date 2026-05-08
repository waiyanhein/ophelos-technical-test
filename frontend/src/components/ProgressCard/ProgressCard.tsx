import { formatCurrency } from '../../lib/format'
import type { MonthlyProgress } from '../../data/mockFinances'
import './ProgressCard.css'

type Props = {
  months: MonthlyProgress[]
  note: string
}

export function ProgressCard({ months, note }: Props) {
  const max = Math.max(...months.map((m) => m.amount))

  return (
    <article className="progress-card">
      <h3 className="progress-card__eyebrow">Your progress over 6 months</h3>
      <ul className="progress-card__rows">
        {months.map((m) => {
          const width = Math.max(8, Math.round((m.amount / max) * 100))
          return (
            <li className="progress-card__row" key={m.month}>
              <span className="progress-card__month">{m.month}</span>
              <span className="progress-card__track" aria-hidden="true">
                <span
                  className={`progress-card__fill progress-card__fill--${m.bucket}`}
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="progress-card__amount">{formatCurrency(m.amount)}</span>
              {m.isCurrent ? <span className="progress-card__now">now</span> : <span />}
            </li>
          )
        })}
      </ul>
      <div className="progress-card__divider" aria-hidden="true" />
      <p className="progress-card__note">{note}</p>
    </article>
  )
}
