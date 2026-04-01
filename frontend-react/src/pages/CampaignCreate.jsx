/**
 * Campaign Create Page
 *
 * Page wrapper for the campaign creation wizard.
 */

import Layout from '../components/layout/Layout';
import CampaignWizard from '../components/campaigns/CampaignWizard';

const CampaignCreate = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Campaign</h1>
          <p className="text-sm text-gray-600 mt-1">
            Follow the steps to create your LinkedIn outreach campaign
          </p>
        </div>

        {/* Wizard */}
        <CampaignWizard />
      </div>
    </Layout>
  );
};

export default CampaignCreate;
