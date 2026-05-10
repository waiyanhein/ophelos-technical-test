import { useDashboardContext } from '../../pages/Dashboard/DashboardContext';
import './Greeting.css';

type Props = {
  firstName: string;
};

/**
 * @IMPORTANT - ideally. It's better if this comes from the backend so that datetime will be synced with other calculations.
 */
const options = Array.from({ length: 6 }, (_, index) => {
  const date = new Date();
  date.setMonth(date.getMonth() - index);
  return {
    label: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
    value: date.toISOString(),
  };
});

export function Greeting({ firstName }: Props) {
  const { handlePeriodChange } = useDashboardContext();
  return (
    <section className="greeting">
      <div>
        <h1 className="greeting__title">Hi {firstName}</h1>
        <p className="greeting__sub">Here is how your finances look this month.</p>
      </div>
      <div className="greeting__select-wrapper">
        <select
          onChange={(e) => {
            handlePeriodChange(e.target.value);
          }}
          className="greeting__select"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="greeting__select-icon"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}
