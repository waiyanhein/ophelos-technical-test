import './SupportCard.css';

const data = {
  support: {
    intro:
      'If you are finding things difficult, a free debt adviser can make a real difference. They are on your side — not the lender’s.',
    links: [
      { label: 'StepChange — free debt advice', href: 'https://www.stepchange.org' },
      { label: 'Citizens Advice', href: 'https://www.citizensadvice.org.uk' },
    ],
  },
};

export function SupportCard() {
  const { links, intro } = data.support;

  return (
    <article className="support-card">
      <h3 className="support-card__title">Free support is available</h3>
      <p className="support-card__intro">{intro}</p>
      <ul className="support-card__links">
        {links.map((link) => (
          <li key={link.href}>
            <a className="support-card__link" href={link.href} target="_blank" rel="noreferrer">
              <span>{link.label}</span>
              <span className="support-card__icon" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
