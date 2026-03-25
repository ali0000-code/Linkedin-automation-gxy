/**
 * Coming Soon Page
 *
 * Placeholder page for features under development.
 */

import Layout from '../components/layout/Layout';

const ComingSoon = ({ title = 'Coming Soon', description = 'This feature is currently under development.' }) => {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-24 h-24 bg-linkedin/10 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-12 h-12 text-linkedin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600 max-w-md mx-auto">{description}</p>
          <div className="mt-8">
            <span className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
              Stay tuned for updates!
            </span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ComingSoon;
