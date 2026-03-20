/**
 * Dashboard Page
 *
 * Main dashboard showing overview statistics, today's activity,
 * active campaigns, and extension status.
 */

import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Spinner from '../components/common/Spinner';
import { useDashboard } from '../hooks/useDashboard';
import { useExtension } from '../hooks/useExtension';

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboard();
  const { isConnected, lastSyncTime } = useExtension();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load dashboard data</p>
        </div>
      </Layout>
    );
  }

  const { prospects, campaigns, today, active_campaigns, next_action } = data || {};

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Overview of your LinkedIn automation
          </p>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Prospects */}
          <StatCard
            title="Total Prospects"
            value={prospects?.total || 0}
            subtitle={`${prospects?.connected || 0} connected`}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="blue"
            onClick={() => navigate('/prospects')}
          />

          {/* Active Campaigns */}
          <StatCard
            title="Active Campaigns"
            value={campaigns?.active || 0}
            subtitle={`${campaigns?.total || 0} total`}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            color="green"
            onClick={() => navigate('/campaign/list')}
          />

          {/* Today's Actions */}
          <StatCard
            title="Today's Actions"
            value={today?.completed || 0}
            subtitle={`${today?.pending || 0} pending`}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            color="purple"
          />

          {/* Prospects with Email */}
          <StatCard
            title="With Email"
            value={prospects?.with_email || 0}
            subtitle="extracted emails"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            color="amber"
            onClick={() => navigate('/mail')}
          />
        </div>

        {/* Today's Activity Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Activity</h2>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Daily Progress</span>
              <span className="font-medium">
                {today?.completed || 0} / {today?.daily_limit || 50} actions
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-linkedin h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(((today?.completed || 0) / (today?.daily_limit || 50)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Action Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <ActionStat label="Visits" value={today?.visits || 0} icon="eye" />
            <ActionStat label="Invites" value={today?.invites || 0} icon="user-plus" />
            <ActionStat label="Messages" value={today?.messages || 0} icon="message" />
            <ActionStat label="Follows" value={today?.follows || 0} icon="check" />
            <ActionStat label="Emails" value={today?.emails || 0} icon="mail" />
          </div>

          {/* Next Action */}
          {next_action && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center text-sm text-gray-600">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Next action: <span className="font-medium ml-1 capitalize">{next_action.action_type}</span>
                <span className="ml-2 text-gray-500">
                  at {new Date(next_action.scheduled_for).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Active Campaigns Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Campaigns</h2>
            <button
              onClick={() => navigate('/campaign/list')}
              className="text-sm text-linkedin hover:underline"
            >
              View All
            </button>
          </div>

          {active_campaigns?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>No active campaigns</p>
              <button
                onClick={() => navigate('/campaign/create')}
                className="mt-2 text-linkedin hover:underline text-sm"
              >
                Create your first campaign
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {active_campaigns?.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onClick={() => navigate(`/campaign/${campaign.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Extension Status Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Extension Status</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <div>
                <p className="font-medium text-gray-900">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </p>
                {lastSyncTime && (
                  <p className="text-sm text-gray-500">
                    Last sync: {new Date(lastSyncTime).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {!isConnected && (
              <p className="text-sm text-gray-500">
                Open LinkedIn in Chrome to connect
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

/**
 * Stat Card Component
 */
const StatCard = ({ title, value, subtitle, icon, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
};

/**
 * Action Stat Component
 */
const ActionStat = ({ label, value, icon }) => {
  const icons = {
    eye: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    ),
    'user-plus': (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    ),
    message: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
    check: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    ),
    mail: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
  };

  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <svg className="w-5 h-5 mx-auto text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {icons[icon]}
      </svg>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
};

/**
 * Campaign Card Component
 */
const CampaignCard = ({ campaign, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1">
        <div className="flex items-center">
          <h3 className="font-medium text-gray-900">{campaign.name}</h3>
          <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
            Active
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{campaign.action_type}</p>
      </div>

      <div className="flex items-center space-x-6">
        {/* Progress */}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {campaign.completed_prospects} / {campaign.total_prospects}
          </p>
          <p className="text-xs text-gray-500">prospects</p>
        </div>

        {/* Progress Bar */}
        <div className="w-24">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-linkedin h-2 rounded-full"
              style={{ width: `${campaign.progress_percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-1">{campaign.progress_percent}%</p>
        </div>

        {/* Today's Actions */}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{campaign.today_actions}</p>
          <p className="text-xs text-gray-500">today</p>
        </div>

        {/* Arrow */}
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

export default Dashboard;
