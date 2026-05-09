import { formatCurrency, formatSignedCurrency } from '../../lib/format'
import type { MoneyGroup, MoneySection, YourMoneyThisMonth } from '../../lib/api'
import './MonthlyMoneyCard.css'

type Props = {
  data: YourMoneyThisMonth
}

export function MonthlyMoneyCard({ data }: Props) {
  return (
    <article className="money-card">
      <h3 className="money-card__eyebrow">Your money this month</h3>
      <div className="money-card__sections">
        <IncomeGroup group={data.income} />
        <OutgoingGroup group={data.outgoing} />
      </div>
      <div className="money-card__outgoings">
        <span className="money-card__outgoings-label">Total outgoings</span>
        <span className="money-card__outgoings-amount">{formatCurrency(data.outgoing.total)}</span>
      </div>
    </article>
  )
}

function IncomeGroup({ group }: { group: MoneyGroup }) {
  if (group.sections.length === 0) return null
  return (
    <>
      {group.sections.map((section) => (
        <Section
          key={section.sectionKey}
          section={section}
          tone="success"
          rowTone="success"
          signed
          showSubtotal
          totalLabel="Total income"
          totalAmount={group.total}
        />
      ))}
    </>
  )
}

function OutgoingGroup({ group }: { group: MoneyGroup }) {
  return (
    <>
      {group.sections.map((section) => (
        <Section
          key={section.sectionKey}
          section={section}
          tone="accent"
          rowTone="ink"
        />
      ))}
    </>
  )
}

type SectionProps = {
  section: MoneySection
  tone: 'success' | 'accent' | 'warning' | 'danger'
  rowTone: 'success' | 'danger' | 'ink'
  signed?: boolean
  showSubtotal?: boolean
  totalLabel?: string
  totalAmount?: number
}

function Section({
  section,
  tone,
  rowTone,
  signed = false,
  showSubtotal = false,
  totalLabel,
  totalAmount,
}: SectionProps) {
  return (
    <section className="money-card__section">
      <span className={`money-card__pill money-card__pill--${tone}`}>{section.sectionLabel}</span>
      <ul className="money-card__rows">
        {section.items.map((item) => (
          <li className="money-card__item" key={item.description}>
            <div className="money-card__row">
              <span className="money-card__row-label">{item.description}</span>
              <span className={`money-card__row-amount money-card__row-amount--${rowTone}`}>
                {signed ? formatSignedCurrency(item.amount) : formatCurrency(item.amount)}
              </span>
            </div>
            {/* Per-item suggestion notes (e.g. "you have 3 streaming
                subscriptions…") are intentionally disabled until the
                suggestion engine is built. */}
            {/* {item.note ? <p className="money-card__note">{item.note}</p> : null} */}
          </li>
        ))}
        {showSubtotal && totalLabel !== undefined && totalAmount !== undefined ? (
          <li className="money-card__item money-card__item--total">
            <div className="money-card__row">
              <span className="money-card__row-label money-card__row-label--total">
                {totalLabel}
              </span>
              <span className={`money-card__row-amount money-card__row-amount--${rowTone}`}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </li>
        ) : null}
      </ul>
    </section>
  )
}
