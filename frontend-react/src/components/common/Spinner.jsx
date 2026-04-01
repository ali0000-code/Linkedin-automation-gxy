/**
 * Spinner Component
 *
 * Loading spinner with different sizes.
 */

import clsx from 'clsx';

/**
 * Spinner component for loading states
 * @param {object} props - Component props
 * @param {string} props.size - Spinner size (sm, md, lg)
 * @param {string} props.className - Additional CSS classes
 */
const Spinner = ({ size = 'md', className }) => {
  const sizeStyles = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-b-2 border-linkedin',
          sizeStyles[size]
        )}
      ></div>
    </div>
  );
};

export default Spinner;
