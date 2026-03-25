/**
 * Input Component
 *
 * Reusable input field component with label and error handling.
 */

import clsx from 'clsx';

/**
 * Input field component
 * @param {object} props - Component props
 * @param {string} props.label - Input label
 * @param {string} props.error - Error message
 * @param {string} props.type - Input type (text, email, password, etc.)
 * @param {string} props.className - Additional CSS classes
 * @param {object} props.rest - Other input props
 */
const Input = ({
  label,
  error,
  type = 'text',
  className,
  ...rest
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={clsx(
          'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin transition-colors',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-linkedin',
          className
        )}
        {...rest}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export default Input;
