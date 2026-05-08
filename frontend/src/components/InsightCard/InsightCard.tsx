import './InsightCard.css'

type Props = {
  body: string
}

export function InsightCard({ body }: Props) {
  return (
    <article className="insight-card">
      <div className="insight-card__head">
        <span className="insight-card__icon" aria-hidden="true" />
        <span className="insight-card__eyebrow">Something worth knowing</span>
      </div>
      <p className="insight-card__body">{body}</p>
    </article>
  )
}
