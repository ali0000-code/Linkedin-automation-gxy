/**
 * Application Constants
 *
 * Centralized constants used throughout the application.
 */

// Connection status options
export const CONNECTION_STATUS = {
  NOT_CONNECTED: 'not_connected',
  PENDING: 'pending',
  CONNECTED: 'connected',
  WITHDRAWN: 'withdrawn'
};

// Connection status labels for UI display
export const CONNECTION_STATUS_LABELS = {
  [CONNECTION_STATUS.NOT_CONNECTED]: 'Not Connected',
  [CONNECTION_STATUS.PENDING]: 'Pending',
  [CONNECTION_STATUS.CONNECTED]: 'Connected',
  [CONNECTION_STATUS.WITHDRAWN]: 'Withdrawn'
};

// Connection status badge colors
export const CONNECTION_STATUS_COLORS = {
  [CONNECTION_STATUS.NOT_CONNECTED]: 'gray',
  [CONNECTION_STATUS.PENDING]: 'yellow',
  [CONNECTION_STATUS.CONNECTED]: 'green',
  [CONNECTION_STATUS.WITHDRAWN]: 'red'
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PER_PAGE: 15,
  PER_PAGE_OPTIONS: [15, 25, 50, 100]
};

// Predefined tag colors for creation
export const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];
