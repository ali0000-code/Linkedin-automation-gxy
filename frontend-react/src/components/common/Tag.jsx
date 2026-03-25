/**
 * Tag Component
 *
 * Colored tag/badge component for displaying prospect tags.
 */

import clsx from 'clsx';

/**
 * Tag component - displays colored badge
 * @param {object} props - Component props
 * @param {string} props.name - Tag name
 * @param {string} props.color - Hex color code
 * @param {boolean} props.removable - Show remove button
 * @param {function} props.onRemove - Callback when remove button clicked
 * @param {string} props.size - Tag size (sm, md)
 * @param {string} props.className - Additional CSS classes
 */
const Tag = ({
  name,
  color = '#3b82f6',
  removable = false,
  onRemove,
  size = 'sm',
  className
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        sizeStyles[size],
        className
      )}
      style={{
        backgroundColor: color + '20', // Add transparency
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {name}
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 hover:opacity-75 focus:outline-none"
        >
          <svg
            className="h-3 w-3"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Tag;
