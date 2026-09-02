// src/shared/ui/compact-query-bar/index.tsx

import { type CSSProperties, type ReactNode } from 'react';

import './compact-query-bar.css';

type CompactQueryBarFieldVariant = 'control' | 'loading' | 'value';

export function CompactQueryBar({ children }: { children: ReactNode }) {
  return <div className="compact-query-bar">{children}</div>;
}

export function CompactQueryBarField({
  children,
  label,
  title,
  truncated = false,
  variant = 'value',
  width,
}: {
  children: ReactNode;
  label: ReactNode;
  title?: string;
  truncated?: boolean;
  variant?: CompactQueryBarFieldVariant;
  width?: CSSProperties['width'];
}) {
  const contentClassName = [
    'compact-query-bar-field-content',
    `compact-query-bar-field-content-${variant}`,
    truncated ? 'compact-query-bar-field-content-truncated' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="compact-query-bar-field">
      <span className="compact-query-bar-field-label">{label}</span>
      <span
        className={contentClassName}
        style={width === undefined ? undefined : { width }}
        title={title}
      >
        {children}
      </span>
    </div>
  );
}

export function CompactQueryBarSeparator() {
  return <span aria-hidden className="compact-query-bar-separator" />;
}

export function CompactQueryBarAction({ children }: { children: ReactNode }) {
  return <span className="compact-query-bar-action">{children}</span>;
}
