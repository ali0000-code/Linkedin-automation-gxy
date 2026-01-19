/**
 * Campaign Creation Wizard
 *
 * Multi-step wizard for creating LinkedIn campaigns.
 * Steps: Name -> Action Type -> Action Config (template/note) -> Tag Selection -> Save/Start
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { useCampaignActions } from '../../hooks/useCampaigns';
import { useTemplates } from '../../hooks/useTemplates';
import { useTags } from '../../hooks/useTags';
import { useCreateCampaign, useAddProspects, useStartCampaign } from '../../hooks/useCampaigns';
import { prospectService } from '../../services/prospect.service';

const CampaignWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    daily_limit: 50,
    selectedAction: null,
    inviteWithNote: false,
    selectedTemplateId: null,
    inviteTemplateId: null, // For connect_message: invite template when not connected
    fallbackTemplateId: null, // For email_message: message fallback template
    selectedTags: [],
  });

  // Fetch available action types
  const { data: actionsData, isLoading: loadingActions } = useCampaignActions();
  const actions = actionsData?.actions || [];

  // Fetch invitation templates
  const { data: invitationTemplatesData } = useTemplates('invitation');
  const invitationTemplates = invitationTemplatesData?.templates || [];

  // Fetch message templates
  const { data: messageTemplatesData } = useTemplates('message');
  const messageTemplates = messageTemplatesData?.templates || [];

  // Fetch email templates
  const { data: emailTemplatesData } = useTemplates('email');
  const emailTemplates = emailTemplatesData?.templates || [];

  // Fetch tags (to show only tags with prospects)
  const { data: tagsData } = useTags();
  const allTags = Array.isArray(tagsData) ? tagsData : [];
  // Filter tags that have prospects
  const tagsWithProspects = allTags.filter(tag => tag.prospects_count > 0);

  // Mutations
  const { mutate: createCampaign, isLoading: isCreating } = useCreateCampaign();
  const { mutate: addProspects } = useAddProspects();
  const { mutate: startCampaign } = useStartCampaign();

  const steps = [
    { number: 1, name: 'Campaign Name' },
    { number: 2, name: 'Select Action' },
    { number: 3, name: 'Configure Action' },
    { number: 4, name: 'Select Tags' },
  ];

  const handleNext = () => {
    // Skip step 3 if action doesn't need configuration
    if (currentStep === 2 && campaignData.selectedAction) {
      const action = actions.find(a => a.id === campaignData.selectedAction);
      // Visit and Follow don't need configuration
      if (action?.key === 'visit' || action?.key === 'follow') {
        setCurrentStep(4);
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    // Skip step 3 when going back if action doesn't need configuration
    if (currentStep === 4 && campaignData.selectedAction) {
      const action = actions.find(a => a.id === campaignData.selectedAction);
      if (action?.key === 'visit' || action?.key === 'follow') {
        setCurrentStep(2);
        return;
      }
    }
    setCurrentStep(prev => prev - 1);
  };

  const handleSave = (shouldStart = false) => {
    const selectedAction = actions.find(a => a.id === campaignData.selectedAction);
    const isEmailAction = selectedAction?.key === 'email';

    // Prepare campaign data
    const payload = {
      name: campaignData.name,
      description: campaignData.description || null,
      daily_limit: campaignData.daily_limit,
      // For email action, we use tag_id directly on campaign (prospects added on start)
      tag_id: isEmailAction && campaignData.selectedTags.length > 0
        ? campaignData.selectedTags[0] // Use first selected tag
        : null,
      steps: [
        {
          campaign_action_id: campaignData.selectedAction,
          order: 1,
          delay_days: 0,
          message_template_id: campaignData.selectedTemplateId || null,
          config: selectedAction?.key === 'invite' && !campaignData.inviteWithNote
            ? { send_without_note: true }
            : selectedAction?.key === 'connect_message'
            ? { invite_template_id: campaignData.inviteTemplateId }
            : selectedAction?.key === 'email_message'
            ? { fallback_template_id: campaignData.fallbackTemplateId }
            : null,
        },
      ],
    };

    // Create campaign
    createCampaign(payload, {
      onSuccess: async (response) => {
        const campaignId = response.campaign.id;

        // For email campaigns, tag_id handles prospect selection on start
        if (isEmailAction) {
          if (shouldStart) {
            startCampaign(campaignId, {
              onSuccess: () => {
                navigate('/campaign/list');
              },
            });
          } else {
            navigate('/campaign/list');
          }
          return;
        }

        // For other campaigns, fetch and add prospects manually
        try {
          // Get ALL prospects for the selected tags (not just first page)
          const prospectsResponse = await prospectService.getProspects({
            tag_ids: campaignData.selectedTags.join(','),
            per_page: 1000 // Fetch up to 1000 prospects for the campaign
          });

          const prospectIds = (prospectsResponse.data || []).map(p => p.id);

          // Add prospects to campaign
          if (prospectIds.length > 0) {
            addProspects(
              { id: campaignId, prospectIds },
              {
                onSuccess: () => {
                  if (shouldStart) {
                    // Start campaign immediately
                    startCampaign(campaignId, {
                      onSuccess: () => {
                        navigate('/campaign/list');
                      },
                    });
                  } else {
                    navigate('/campaign/list');
                  }
                },
              }
            );
          } else {
            navigate('/campaign/list');
          }
        } catch (error) {
          console.error('Failed to fetch prospects for tags:', error);
          navigate('/campaign/list');
        }
      },
    });
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return campaignData.name.trim() !== '';
      case 2:
        return campaignData.selectedAction !== null;
      case 3:
        const action = actions.find(a => a.id === campaignData.selectedAction);
        if (action?.key === 'invite') {
          return campaignData.inviteWithNote ? campaignData.selectedTemplateId !== null : true;
        }
        if (action?.key === 'message') {
          return campaignData.selectedTemplateId !== null;
        }
        if (action?.key === 'email') {
          // Email template is required for email action
          return campaignData.selectedTemplateId !== null;
        }
        if (action?.key === 'connect_message') {
          // Both templates required for connect_message
          return campaignData.selectedTemplateId !== null && campaignData.inviteTemplateId !== null;
        }
        if (action?.key === 'visit_follow_connect') {
          // Only invitation template required
          return campaignData.selectedTemplateId !== null;
        }
        if (action?.key === 'email_message') {
          // Both email template and fallback message template required
          return campaignData.selectedTemplateId !== null && campaignData.fallbackTemplateId !== null;
        }
        return true;
      case 4:
        return campaignData.selectedTags.length > 0;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepName campaignData={campaignData} setCampaignData={setCampaignData} />;
      case 2:
        return (
          <StepActionSelection
            actions={actions}
            loading={loadingActions}
            campaignData={campaignData}
            setCampaignData={setCampaignData}
          />
        );
      case 3:
        return (
          <StepActionConfig
            actions={actions}
            invitationTemplates={invitationTemplates}
            messageTemplates={messageTemplates}
            emailTemplates={emailTemplates}
            campaignData={campaignData}
            setCampaignData={setCampaignData}
          />
        );
      case 4:
        return (
          <StepTagSelection
            tags={tagsWithProspects}
            campaignData={campaignData}
            setCampaignData={setCampaignData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step.number
                      ? 'bg-linkedin text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step.number}
                </div>
                <div className="mt-2 text-sm font-medium text-gray-700">{step.name}</div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-4 ${
                    currentStep > step.number ? 'bg-linkedin' : 'bg-gray-200'
                  }`}
                  style={{ width: '100px' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow p-8 mb-6">{renderStep()}</div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
        </div>
        <div className="flex space-x-3">
          <Button variant="secondary" onClick={() => navigate('/campaign/list')}>
            Cancel
          </Button>
          {currentStep < 4 ? (
            <Button variant="primary" onClick={handleNext} disabled={!isStepValid()}>
              Next
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={!isStepValid() || isCreating}
              >
                {isCreating ? <Spinner size="sm" /> : 'Save as Draft'}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
                disabled={!isStepValid() || isCreating}
              >
                {isCreating ? <Spinner size="sm" /> : 'Save & Start'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Step 1: Campaign Name
const StepName = ({ campaignData, setCampaignData }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Campaign Details</h2>
        <p className="text-sm text-gray-600">Give your campaign a name and description</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Campaign Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={campaignData.name}
          onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
          placeholder="e.g., Outreach to Marketing Managers"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
        <textarea
          value={campaignData.description}
          onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
          placeholder="Brief description of your campaign goals..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Daily Limit</label>
        <input
          type="number"
          value={campaignData.daily_limit}
          onChange={(e) =>
            setCampaignData({ ...campaignData, daily_limit: parseInt(e.target.value) || 50 })
          }
          min="1"
          max="100"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">Maximum number of actions per day (1-100)</p>
      </div>
    </div>
  );
};

// Step 2: Action Selection
const StepActionSelection = ({ actions, loading, campaignData, setCampaignData }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Select Action Type</h2>
        <p className="text-sm text-gray-600">Choose what action to perform on LinkedIn</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action) => (
          <div
            key={action.id}
            onClick={() => setCampaignData({ ...campaignData, selectedAction: action.id })}
            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
              campaignData.selectedAction === action.id
                ? 'border-linkedin bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  campaignData.selectedAction === action.id ? 'bg-linkedin' : 'bg-gray-100'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    campaignData.selectedAction === action.id ? 'text-white' : 'text-gray-600'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {action.key === 'visit' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  )}
                  {action.key === 'invite' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  )}
                  {action.key === 'message' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  )}
                  {action.key === 'follow' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  )}
                  {action.key === 'email' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  )}
                  {action.key === 'connect_message' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  )}
                  {action.key === 'visit_follow_connect' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  )}
                  {action.key === 'email_message' && (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </>
                  )}
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{action.name}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Step 3: Action Configuration
const StepActionConfig = ({
  actions,
  invitationTemplates,
  messageTemplates,
  emailTemplates,
  campaignData,
  setCampaignData,
}) => {
  const selectedAction = actions.find((a) => a.id === campaignData.selectedAction);

  if (!selectedAction) return null;

  // Invite action: with note or without
  if (selectedAction.key === 'invite') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Connection Request</h2>
          <p className="text-sm text-gray-600">Choose whether to include a note with your invitation</p>
        </div>

        <div className="space-y-4">
          {/* Send without note */}
          <div
            onClick={() =>
              setCampaignData({
                ...campaignData,
                inviteWithNote: false,
                selectedTemplateId: null,
              })
            }
            className={`p-4 border-2 rounded-lg cursor-pointer ${
              !campaignData.inviteWithNote ? 'border-linkedin bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                checked={!campaignData.inviteWithNote}
                onChange={() => {}}
                className="w-4 h-4 text-linkedin focus:ring-linkedin"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Send without note</div>
                <div className="text-xs text-gray-500">Send connection request without a message</div>
              </div>
            </div>
          </div>

          {/* Send with note */}
          <div
            onClick={() => setCampaignData({ ...campaignData, inviteWithNote: true })}
            className={`p-4 border-2 rounded-lg cursor-pointer ${
              campaignData.inviteWithNote ? 'border-linkedin bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                checked={campaignData.inviteWithNote}
                onChange={() => {}}
                className="w-4 h-4 text-linkedin focus:ring-linkedin"
              />
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Send with personalized note</div>
                <div className="text-xs text-gray-500">Include a message (max 300 characters)</div>
              </div>
            </div>
          </div>

          {/* Template selection */}
          {campaignData.inviteWithNote && (
            <div className="ml-7 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Invitation Template
              </label>
              {invitationTemplates.length === 0 ? (
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
                  No invitation templates found. Please create one first in Message Templates.
                </div>
              ) : (
                <select
                  value={campaignData.selectedTemplateId || ''}
                  onChange={(e) =>
                    setCampaignData({
                      ...campaignData,
                      selectedTemplateId: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
                >
                  <option value="">Select a template...</option>
                  {invitationTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              )}

              {campaignData.selectedTemplateId && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Preview:</div>
                  <div className="text-sm text-gray-700">
                    {
                      invitationTemplates.find((t) => t.id === campaignData.selectedTemplateId)
                        ?.content
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Message action: select template
  if (selectedAction.key === 'message') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Message</h2>
          <p className="text-sm text-gray-600">Select a message template to send</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Message Template
          </label>
          {messageTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
              No message templates found. Please create one first in Message Templates.
            </div>
          ) : (
            <>
              <select
                value={campaignData.selectedTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    selectedTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {messageTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.selectedTemplateId && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Preview:</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {messageTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.content}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Email action: select email template for later use
  if (selectedAction.key === 'email') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Email</h2>
          <p className="text-sm text-gray-600">
            Select an email template to use when sending emails to prospects.
            The extension will visit each prospect's profile and extract their email from Contact Info.
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-700">
              <strong>How it works:</strong> The extension will automatically visit each prospect's LinkedIn profile,
              open their Contact Info, and extract their email address. After extraction completes, you'll see
              which prospects have emails and can send emails to them.
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Email Template <span className="text-red-500">*</span>
          </label>
          {emailTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
              No email templates found. Please create one first in Message Templates (select "Email" type).
            </div>
          ) : (
            <>
              <select
                value={campaignData.selectedTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    selectedTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select an email template...</option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.selectedTemplateId && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Email Preview:</div>
                  <div className="text-sm text-gray-700">
                    <div className="font-medium mb-1">
                      Subject: {emailTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.subject || 'No subject'}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {emailTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.content}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Smart Connect action: select both message and invite templates
  if (selectedAction.key === 'connect_message') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Connect + Message</h2>
          <p className="text-sm text-gray-600">
            Automatically adapts based on connection status:
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="text-sm text-blue-700">
              <strong>How it works:</strong>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>If already connected → Sends a direct message</li>
                <li>If not connected → Sends a connection request with note</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Message Template (for connected users) */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">If Connected</div>
              <div className="text-xs text-gray-500">Message to send to existing connections</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Template <span className="text-red-500">*</span>
          </label>
          {messageTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              No message templates found. Please create one first.
            </div>
          ) : (
            <>
              <select
                value={campaignData.selectedTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    selectedTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select message template...</option>
                {messageTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.selectedTemplateId && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  {messageTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.content}
                </div>
              )}
            </>
          )}
        </div>

        {/* Invite Template (for not connected users) */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">If Not Connected</div>
              <div className="text-xs text-gray-500">Connection request note (max 300 chars)</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invitation Template <span className="text-red-500">*</span>
          </label>
          {invitationTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              No invitation templates found. Please create one first.
            </div>
          ) : (
            <>
              <select
                value={campaignData.inviteTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    inviteTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select invitation template...</option>
                {invitationTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.inviteTemplateId && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  {invitationTemplates.find((t) => t.id === campaignData.inviteTemplateId)?.content}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Warm Connect action: visit + follow + connect combo
  if (selectedAction.key === 'visit_follow_connect') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Visit + Follow + Connect</h2>
          <p className="text-sm text-gray-600">
            Warms up prospects before sending a connection request
          </p>
        </div>

        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <div className="text-sm text-amber-700">
              <strong>How it works:</strong>
              <ol className="mt-1 list-decimal list-inside space-y-1">
                <li>Visit the prospect's LinkedIn profile</li>
                <li>Follow their profile</li>
                <li>Send a connection request with your note</li>
              </ol>
              <p className="mt-2 text-xs">This sequence increases acceptance rates by building familiarity first.</p>
            </div>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-linkedin flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Connection Request Note</div>
              <div className="text-xs text-gray-500">Message sent with connection request (max 300 chars)</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invitation Template <span className="text-red-500">*</span>
          </label>
          {invitationTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              No invitation templates found. Please create one first.
            </div>
          ) : (
            <>
              <select
                value={campaignData.selectedTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    selectedTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select invitation template...</option>
                {invitationTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.selectedTemplateId && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  {invitationTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.content}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Smart Email action: email with message fallback
  if (selectedAction.key === 'email_message') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Configure Email + Message</h2>
          <p className="text-sm text-gray-600">
            Sends email if available, with LinkedIn message as fallback
          </p>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-purple-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="text-sm text-purple-700">
              <strong>How it works:</strong>
              <ol className="mt-1 list-decimal list-inside space-y-1">
                <li>If prospect has email → Send email</li>
                <li>If no email → Visit profile and extract email from Contact Info</li>
                <li>If extraction successful → Send email</li>
                <li>If no email found → Send LinkedIn message as fallback</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Email Template (primary) */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Primary: Email</div>
              <div className="text-xs text-gray-500">Sent when prospect has an email address</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Template <span className="text-red-500">*</span>
          </label>
          {emailTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              No email templates found. Please create one first.
            </div>
          ) : (
            <>
              <select
                value={campaignData.selectedTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    selectedTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select email template...</option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.selectedTemplateId && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-500 mb-1">Subject:</div>
                  <div className="text-sm text-gray-700 font-medium mb-2">
                    {emailTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.subject || 'No subject'}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Body:</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">
                    {emailTemplates.find((t) => t.id === campaignData.selectedTemplateId)?.content}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Fallback Message Template */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Fallback: LinkedIn Message</div>
              <div className="text-xs text-gray-500">Sent when no email can be found</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Template <span className="text-red-500">*</span>
          </label>
          {messageTemplates.length === 0 ? (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              No message templates found. Please create one first.
            </div>
          ) : (
            <>
              <select
                value={campaignData.fallbackTemplateId || ''}
                onChange={(e) =>
                  setCampaignData({
                    ...campaignData,
                    fallbackTemplateId: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select message template...</option>
                {messageTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              {campaignData.fallbackTemplateId && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                  {messageTemplates.find((t) => t.id === campaignData.fallbackTemplateId)?.content}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

// Step 4: Tag Selection
const StepTagSelection = ({ tags, campaignData, setCampaignData }) => {
  const toggleTag = (tagId) => {
    const isSelected = campaignData.selectedTags.includes(tagId);
    if (isSelected) {
      setCampaignData({
        ...campaignData,
        selectedTags: campaignData.selectedTags.filter((id) => id !== tagId),
      });
    } else {
      setCampaignData({
        ...campaignData,
        selectedTags: [...campaignData.selectedTags, tagId],
      });
    }
  };

  const totalProspects = tags
    .filter((tag) => campaignData.selectedTags.includes(tag.id))
    .reduce((sum, tag) => sum + (tag.prospects_count || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Select Tags</h2>
        <p className="text-sm text-gray-600">
          Choose which tagged prospects to include in this campaign
        </p>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No tags with prospects found.</p>
          <p className="text-sm">Create some tags and add prospects to them first.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  campaignData.selectedTags.includes(tag.id)
                    ? 'border-linkedin bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={campaignData.selectedTags.includes(tag.id)}
                      onChange={() => {}}
                      className="w-4 h-4 text-linkedin rounded focus:ring-linkedin"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium text-gray-900">{tag.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{tag.prospects_count} prospects</div>
                </div>
              </div>
            ))}
          </div>

          {campaignData.selectedTags.length > 0 && (
            <div className="p-4 bg-linkedin-light rounded-lg">
              <div className="text-sm font-medium text-gray-900">
                Total prospects: <span className="text-linkedin font-bold">{totalProspects}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CampaignWizard;
