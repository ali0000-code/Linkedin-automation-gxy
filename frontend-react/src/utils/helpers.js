/**
 * Helper Utilities
 *
 * Common utility functions used throughout the application.
 */

import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @param {string} formatStr - Format string (default: 'MMM dd, yyyy')
 * @returns {string} Formatted date
 */
export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
  if (!date) return '-';
  return format(new Date(date), formatStr);
};

/**
 * Format date to relative time (e.g., "2 days ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeDate = (date) => {
  if (!date) return '-';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text
 */
export const truncate = (text, length = 50) => {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials (e.g., "John Doe" -> "JD")
 */
export const getInitials = (name) => {
  if (!name) return '?';

  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Handle API error and extract user-friendly message
 * @param {Error} error - Error object from API
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.errors) {
    const errors = error.response.data.errors;
    const firstKey = Object.keys(errors)[0];
    return errors[firstKey][0];
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Debounce function - delays function execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Build query string from object
 * @param {object} params - Parameters object
 * @returns {string} Query string
 */
export const buildQueryString = (params) => {
  const filtered = Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return filtered ? `?${filtered}` : '';
};
