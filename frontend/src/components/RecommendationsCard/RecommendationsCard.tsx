import './RecommendationsCard.css'

export function RecommendationsCard({ recommendations }: { recommendations: string[] }) {
  return (
    <article className="recommendations-card">
      <div className="recommendations-card__head">
        <span className="recommendations-card__icon" aria-hidden="true" />
        <span className="recommendations-card__eyebrow">Suggestions for you</span>
      </div>
      <ul className="money-card__recommendations-list">
            {recommendations.map((suggestion, index) => (
              <li key={index} className="money-card__recommendation">
                <span className="money-card__recommendation-icon" aria-hidden="true">
                  💡
                </span>
                <span className="money-card__recommendation-text">{suggestion}</span>
              </li>
            ))}
          </ul>
    </article>
  )
}
