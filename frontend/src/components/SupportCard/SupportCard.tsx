import type { SupportLink } from '../../data/mockFinances'
import './SupportCard.css'

type Props = {
  intro: string
  links: SupportLink[]
}

export function SupportCard({ intro, links }: Props) {
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
  )
}
