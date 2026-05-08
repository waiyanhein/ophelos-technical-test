import './Greeting.css'

type Props = {
  firstName: string
}

export function Greeting({ firstName }: Props) {
  return (
    <section className="greeting">
      <h1 className="greeting__title">Hi {firstName}</h1>
      <p className="greeting__sub">
        Here is how your finances look this month. Things are moving in the right direction.
      </p>
    </section>
  )
}
