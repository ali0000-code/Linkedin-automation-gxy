/**
 * Layout Component
 *
 * Main application layout wrapper with sidebar navigation.
 * Wraps all authenticated pages.
 */

import Sidebar from './Sidebar';

/**
 * Layout wrapper component
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Page content
 */
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
