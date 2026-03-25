/**
 * Header Component
 *
 * Top navigation bar with logo, navigation links, and user menu.
 */

import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';
import Button from '../common/Button';

const Header = () => {
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();

  /**
   * Handle logout button click
   */
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <Link to="/prospects" className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-linkedin rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">
                LinkedIn Automation
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/prospects"
              className="text-gray-700 hover:text-linkedin font-medium transition-colors"
            >
              Prospects
            </Link>
            <Link
              to="/tags"
              className="text-gray-700 hover:text-linkedin font-medium transition-colors"
            >
              Tags
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="hidden sm:flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  loading={logoutMutation.isPending}
                >
                  Logout
                </Button>
              </div>
            )}

            {/* Mobile logout button */}
            <div className="sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                loading={logoutMutation.isPending}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
