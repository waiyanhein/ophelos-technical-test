import './RecommendationsCard.css';

export function RecommendationsCard({ recommendations }: { recommendations: string[] }) {
  return (
    <article className="recommendations-card">
      <div className="recommendations-card__head">
        <span>💡</span>
        <span className="recommendations-card__eyebrow">Suggestions for you</span>
      </div>
      <ul className="money-card__recommendations-list">
        {recommendations.map((suggestion, index) => (
          <li key={index} className="money-card__recommendation">
            <span className="money-card__recommendation-text">{suggestion}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
