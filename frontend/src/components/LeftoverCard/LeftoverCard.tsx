import { formatCurrency } from '../../lib/format'
import './LeftoverCard.css'

type Props = {
  amount: number
  status: { label: string; tone: 'warning' | 'success' | 'danger' }
  headline: string
  body: string
}

export function LeftoverCard({ amount, status, headline, body }: Props) {
  return (
    <article className="leftover-card">
      <div className="leftover-card__amount">
        <div className={`leftover-card__figure figure-${status.tone.toLowerCase()}`}>{formatCurrency(amount)}</div>
        <div className="leftover-card__caption">left over each month</div>
      </div>
      <div className="leftover-card__divider" aria-hidden="true" />
      <div className="leftover-card__body">
        <span className={`leftover-card__badge leftover-card__badge--${status.tone}`}>
          <span className="leftover-card__badge-dot" aria-hidden="true" />
          {status.label}
        </span>
        <h2 className="leftover-card__headline">{headline}</h2>
        <p className="leftover-card__copy">{body}</p>
      </div>
    </article>
  )
}
