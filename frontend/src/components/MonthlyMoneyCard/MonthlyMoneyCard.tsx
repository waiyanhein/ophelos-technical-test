import { formatSignedCurrency, formatCurrency } from '../../lib/format'
import type { MoneySection, MoneyThisMonth } from '../../data/mockFinances'
import './MonthlyMoneyCard.css'

type Props = {
  data: MoneyThisMonth
}

export function MonthlyMoneyCard({ data }: Props) {
  return (
    <article className="money-card">
      <h3 className="money-card__eyebrow">Your money this month</h3>
      <div className="money-card__sections">
        {data.sections.map((section) => (
          <Section key={section.title} section={section} />
        ))}
      </div>
      <div className="money-card__outgoings">
        <span className="money-card__outgoings-label">{data.outgoingsTotal.label}</span>
        <span className="money-card__outgoings-amount">
          {formatCurrency(data.outgoingsTotal.amount)}
        </span>
      </div>
    </article>
  )
}

function Section({ section }: { section: MoneySection }) {
  const rowTone = section.rowTone ?? 'ink'
  return (
    <section className="money-card__section">
      <span className={`money-card__pill money-card__pill--${section.tone}`}>{section.title}</span>
      <ul className="money-card__rows">
        {section.items.map((item) => (
          <li className="money-card__item" key={item.label}>
            <div className="money-card__row">
              <span className="money-card__row-label">{item.label}</span>
              <span className={`money-card__row-amount money-card__row-amount--${rowTone}`}>
                {item.signed ? formatSignedCurrency(item.amount) : formatCurrency(item.amount)}
              </span>
            </div>
            {item.note ? <p className="money-card__note">{item.note}</p> : null}
          </li>
        ))}
        {section.total ? (
          <li className="money-card__item money-card__item--total">
            <div className="money-card__row">
              <span className="money-card__row-label money-card__row-label--total">
                {section.total.label}
              </span>
              <span className={`money-card__row-amount money-card__row-amount--${rowTone}`}>
                {formatCurrency(section.total.amount)}
              </span>
            </div>
          </li>
        ) : null}
      </ul>
    </section>
  )
}
