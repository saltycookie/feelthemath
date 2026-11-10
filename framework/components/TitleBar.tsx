import React from 'react';

export interface TitleBarProps {
  title: string;
  onHomeClick?: () => void;
  homeLabel?: string;
  homeHref?: string;
}

/**
 * Shared Title Area Component (Requirement 2):
 * Positioned at the top of the canvas with the "Home" icon (`All demos`) on the left
 * and the current step's title centered in the middle.
 */
export const TitleBar: React.FC<TitleBarProps> = ({
  title,
  onHomeClick,
  homeLabel = 'All demos',
  homeHref = '../../',
}) => {
  return (
    <header className="titlebar" role="banner">
      <a
        className="home"
        href={homeHref}
        aria-label={homeLabel}
        onClick={onHomeClick}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 7.5 8 2.5l6 5" />
          <path d="M3.5 6.5V13a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V6.5" />
        </svg>
        <span>{homeLabel}</span>
      </a>

      <p className="step-title" aria-live="polite" key={title}>
        {title}
      </p>
    </header>
  );
};
