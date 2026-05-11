import { useState } from 'react';
import { useDashboardContext } from '../DashboardContext';
import './Greeting.css';

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

export function Greeting() {
  const getFirstName = (name: string) => {
    return name.split(' ')[0];
  };
  const {
    handlePeriodChange,
    period,
    onDownloadPdf,
    onShareStatement,
    sharableUrl,
    shareError,
    isSharing,
    onDismissSharableUrl,
    user,
    isShared,
    dashboard,
  } = useDashboardContext();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    if (!sharableUrl) return;
    try {
      await navigator.clipboard.writeText(sharableUrl);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="greeting">
      <div>
        <h1 className="greeting__title">
          {isShared ? user?.name : `Hi ${getFirstName(user?.name ?? '')}`}
        </h1>
        <p className="greeting__sub">
          {isShared
            ? 'Here is how the finances looked in '
            : 'Here is how your finances look like in '}
          {period?.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </p>
        {shareError ? (
          <p className="greeting__share-error" role="alert">
            {shareError}
          </p>
        ) : null}
      </div>
      <div className="greeting__actions">
        {!isShared ? (
          <button
            type="button"
            className="greeting__download"
            onClick={onShareStatement}
            disabled={isSharing || dashboard === null}
          >
            {isSharing ? 'Sharing…' : 'Share'}
          </button>
        ) : null}
        <button
          disabled={dashboard === null}
          type="button"
          className="greeting__download"
          onClick={onDownloadPdf}
        >
          Download
        </button>
        {!isShared ? (
          <div className="greeting__select-wrapper">
            <select
              disabled={dashboard === null}
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
        ) : null}
      </div>
      {sharableUrl ? (
        <div className="greeting__share-result" role="status" aria-live="polite">
          <p className="greeting__share-success">
            Sharable statement link created:{' '}
            <a className="greeting__share-link" href={sharableUrl}>
              {sharableUrl}
            </a>
          </p>
          <button type="button" className="greeting__share-copy" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            type="button"
            className="greeting__share-close"
            onClick={onDismissSharableUrl}
            aria-label="Dismiss sharable statement link"
          >
            ×
          </button>
        </div>
      ) : null}
    </section>
  );
}
