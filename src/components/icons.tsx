/**
 * Small inline line icons for the reader's header buttons. Hand-rolled
 * rather than pulled from an icon library so the package doesn't pick up a
 * new dependency for five glyphs — each renders via `currentColor`, so it
 * always matches the surrounding button's text color instead of carrying
 * its own fixed (and, for emoji, platform-colored) appearance.
 */

import React from 'react';

export interface IconProps {
  size?: number | string;
}

const defaultProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function BookmarkIcon({ size = '1.1em', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...defaultProps} width={size} height={size} fill={filled ? 'currentColor' : 'none'}>
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  );
}

export function ChaptersIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size}>
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <line x1="9" y1="6" x2="20" y2="6" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
      <line x1="9" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function NoteIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size}>
      <path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M15 3v4h4" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
      <line x1="8.5" y1="15.5" x2="13.5" y2="15.5" />
    </svg>
  );
}

export function SearchIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.3" y1="15.3" x2="21" y2="21" />
    </svg>
  );
}

export function SinglePageIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size}>
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <line x1="8.5" y1="8" x2="15.5" y2="8" />
      <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" />
      <line x1="8.5" y1="15" x2="13" y2="15" />
    </svg>
  );
}

export function DoublePageIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size}>
      <rect x="2.5" y="4" width="8.5" height="16" rx="1.3" />
      <rect x="13" y="4" width="8.5" height="16" rx="1.3" />
      <line x1="4.5" y1="8" x2="9.5" y2="8" />
      <line x1="4.5" y1="11.5" x2="9.5" y2="11.5" />
      <line x1="15" y1="8" x2="20" y2="8" />
      <line x1="15" y1="11.5" x2="20" y2="11.5" />
    </svg>
  );
}

export function ScrollIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size}>
      <ellipse cx="12" cy="4.5" rx="6" ry="2" />
      <ellipse cx="12" cy="19.5" rx="6" ry="2" />
      <line x1="6" y1="4.5" x2="6" y2="19.5" />
      <line x1="18" y1="4.5" x2="18" y2="19.5" />
      <line x1="9" y1="10.5" x2="15" y2="10.5" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function ExitFullscreenIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size} strokeWidth={1.7}>
      <path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4" />
      <path d="M15 4v3.5A1.5 1.5 0 0 0 16.5 9H20" />
      <path d="M20 15h-3.5A1.5 1.5 0 0 0 15 16.5V20" />
      <path d="M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size} strokeWidth={2}>
      <path d="M15 4l-8 8 8 8" />
    </svg>
  );
}

export function ChevronRightIcon({ size = '1.1em' }: IconProps) {
  return (
    <svg {...defaultProps} width={size} height={size} strokeWidth={2}>
      <path d="M9 4l8 8-8 8" />
    </svg>
  );
}
