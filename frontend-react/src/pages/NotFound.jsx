/**
 * NotFound Page (404)
 *
 * Displayed when user navigates to non-existent route.
 */

import { Link } from 'react-router-dom';
import Button from '../components/common/Button';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page not found</p>
        <p className="mt-2 text-gray-500">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link to="/prospects">
            <Button variant="primary">Go to Prospects</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
