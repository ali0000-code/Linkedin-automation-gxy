/**
 * Campaign Details Page
 *
 * View detailed information about a campaign including:
 * - Campaign info, status, and statistics
 * - Campaign steps/actions
 * - List of prospects in the campaign
 * - Actions to start/pause/delete campaign
 */

import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { useCampaign, useDeleteCampaign, useStartCampaign, usePauseCampaign } from '../hooks/useCampaigns';

const CampaignDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Fetch campaign details
  const { data, isLoading } = useCampaign(id);
  const campaign = data?.campaign;

  // Mutations
  const { mutate: deleteCampaign } = useDeleteCampaign();
  const { mutate: startCampaign } = useStartCampaign();
  const { mutate: pauseCampaign } = usePauseCampaign();

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${campaign?.name}"?`)) {
      deleteCampaign(id, {
        onSuccess: () => {
          navigate('/campaign/list');
        },
      });
    }
  };

  const handleStart = () => {
    startCampaign(id);
  };

  const handlePause = () => {
    pauseCampaign(id);
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-blue-100 text-blue-800',
      archived: 'bg-gray-100 text-gray-600',
    };

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Not Found</h2>
          <p className="text-gray-600 mb-6">The campaign you're looking for doesn't exist.</p>
          <Button variant="primary" onClick={() => navigate('/campaign/list')}>
            Back to Campaigns
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            {campaign.description && (
              <p className="text-sm text-gray-600">{campaign.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            {campaign.status === 'draft' && (
              <Button variant="primary" onClick={handleStart}>
                Start Campaign
              </Button>
            )}
            {campaign.status === 'active' && (
              <Button variant="warning" onClick={handlePause}>
                Pause Campaign
              </Button>
            )}
            {campaign.status === 'paused' && (
              <Button variant="primary" onClick={handleStart}>
                Resume Campaign
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/campaign/list')}>
              Back to List
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Prospects</div>
            <div className="text-3xl font-bold text-gray-900">{campaign.total_prospects}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Processed</div>
            <div className="text-3xl font-bold text-linkedin">{campaign.processed_prospects}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Success</div>
            <div className="text-3xl font-bold text-green-600">{campaign.success_count}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Failed</div>
            <div className="text-3xl font-bold text-red-600">{campaign.failure_count}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
            <span className="text-sm text-gray-600">
              {campaign.total_prospects > 0
                ? Math.round((campaign.processed_prospects / campaign.total_prospects) * 100)
                : 0}
              % Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-linkedin h-4 rounded-full transition-all"
              style={{
                width: `${
                  campaign.total_prospects > 0
                    ? (campaign.processed_prospects / campaign.total_prospects) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        {/* Campaign Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Campaign Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Information</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-600">Daily Limit</dt>
                <dd className="text-sm text-gray-900">{campaign.daily_limit} actions/day</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-600">Created</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(campaign.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
              {campaign.started_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-600">Started</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(campaign.started_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
              )}
              {campaign.completed_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-600">Completed</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(campaign.completed_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Right Column: Campaign Steps */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Actions</h3>
            {campaign.steps && campaign.steps.length > 0 ? (
              <div className="space-y-3">
                {campaign.steps.map((step, index) => (
                  <div key={step.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 bg-linkedin text-white rounded-full flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {step.action?.name || 'Unknown Action'}
                      </div>
                      {step.message_template && (
                        <div className="text-xs text-gray-600 mt-1">
                          Template: {step.message_template.name}
                        </div>
                      )}
                      {step.delay_days > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Delay: {step.delay_days} day(s)
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No actions configured</p>
            )}
          </div>
        </div>

        {/* Prospects List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Prospects in Campaign</h3>
          </div>
          {campaign.campaign_prospects && campaign.campaign_prospects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Step
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaign.campaign_prospects.map((cp) => (
                    <tr key={cp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {cp.prospect?.full_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">{cp.prospect?.profile_url}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            cp.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : cp.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : cp.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {cp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Step {cp.current_step || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cp.last_action_at
                          ? new Date(cp.last_action_at).toLocaleDateString()
                          : 'Not started'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-gray-500">
              <p>No prospects in this campaign yet.</p>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-600 mb-4">
            Once you delete a campaign, there is no going back. Please be certain.
          </p>
          <Button variant="danger" onClick={handleDelete}>
            Delete Campaign
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default CampaignDetails;
