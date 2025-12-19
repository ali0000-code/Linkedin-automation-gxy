/**
 * Mail Page
 *
 * Displays sent emails with filtering and search.
 * Shows extraction results modal when email campaigns complete.
 */

import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import {
  useMails,
  useMailStats,
  usePendingExtractions,
  useQueueFromCampaign,
  useDiscardExtraction,
  useSendEmail,
  useSendBulk,
  useDeleteEmail,
  useDeleteBulk,
  useUpdateEmail,
  useCreateEmail,
} from '../hooks/useMail';
import { useTemplates } from '../hooks/useTemplates';

// Edit Icon
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// Plus Icon
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// Icons
const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// Status Badge Component
const StatusBadge = ({ status }) => {
  const config = {
    sent: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: <CheckIcon />,
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      icon: <XIcon />,
    },
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      icon: <ClockIcon />,
    },
    draft: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      icon: <ClockIcon />,
    },
  };

  const { bg, text, icon } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      <span className="capitalize">{status}</span>
    </span>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
        </div>
      </div>
    </div>
  );
};

// Extraction Results Modal Component
const ExtractionResultsModal = ({
  campaign,
  templates,
  onSendNow,
  onSendLater,
  onDiscard,
  onClose,
  isLoading,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showChangeTemplate, setShowChangeTemplate] = useState(false);

  // Use the campaign's template by default
  const campaignTemplate = campaign.template;
  const emailTemplates = Array.isArray(templates) ? templates.filter(t => t.type === 'email') : [];

  // Set initial template from campaign
  useEffect(() => {
    if (campaignTemplate && !selectedTemplateId) {
      setSelectedTemplateId(campaignTemplate.id);
    }
  }, [campaignTemplate, selectedTemplateId]);

  const currentTemplate = selectedTemplateId
    ? emailTemplates.find(t => t.id === parseInt(selectedTemplateId)) || campaignTemplate
    : campaignTemplate;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-linkedin text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BellIcon />
              <h3 className="text-lg font-semibold">Email Extraction Complete</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200"
            >
              <XIcon />
            </button>
          </div>
          <p className="text-sm text-blue-100 mt-1">Campaign: {campaign.name}</p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{campaign.with_email_count}</p>
              <p className="text-sm text-green-700">Emails Found</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-gray-600">{campaign.without_email_count}</p>
              <p className="text-sm text-gray-700">Not Found</p>
            </div>
          </div>

          {/* Template Info */}
          {campaign.with_email_count > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email Template
                </label>
                <button
                  type="button"
                  onClick={() => setShowChangeTemplate(!showChangeTemplate)}
                  className="text-sm text-linkedin hover:underline"
                >
                  {showChangeTemplate ? 'Cancel' : 'Change Template'}
                </button>
              </div>

              {showChangeTemplate ? (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
                >
                  {emailTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              ) : currentTemplate ? (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="font-medium text-gray-900">{currentTemplate.name}</p>
                  {currentTemplate.subject && (
                    <p className="text-sm text-gray-600 mt-1">
                      Subject: {currentTemplate.subject}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                  No template selected. You can save as draft and add a template later, or select one now.
                  <button
                    type="button"
                    onClick={() => setShowChangeTemplate(true)}
                    className="ml-2 text-linkedin underline"
                  >
                    Select Template
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Prospects with Email */}
          {campaign.prospects_with_email?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Prospects with Email ({campaign.with_email_count})
              </h4>
              <div className="bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {campaign.prospects_with_email.map((prospect) => (
                    <li key={prospect.id} className="px-3 py-2 flex justify-between items-center">
                      <span className="text-sm text-gray-900">{prospect.full_name}</span>
                      <span className="text-sm text-gray-500">{prospect.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Prospects without Email */}
          {campaign.prospects_without_email?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                Prospects without Email ({campaign.without_email_count})
              </h4>
              <div className="bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {campaign.prospects_without_email.map((prospect) => (
                    <li key={prospect.id} className="px-3 py-2">
                      <span className="text-sm text-gray-600">{prospect.full_name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {campaign.with_email_count > 0 ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                onClick={onDiscard}
                disabled={isLoading}
                className="flex-1"
              >
                Don't Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => onSendLater(selectedTemplateId || null)}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? <Spinner size="sm" /> : 'Save as Draft'}
              </Button>
              <Button
                onClick={() => onSendNow(selectedTemplateId || campaignTemplate?.id)}
                disabled={isLoading || (!selectedTemplateId && !campaignTemplate)}
                className="flex-1"
                title={!selectedTemplateId && !campaignTemplate ? 'Template required for sending' : ''}
              >
                {isLoading ? <Spinner size="sm" /> : 'Send Now'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
          {!selectedTemplateId && !campaignTemplate && campaign.with_email_count > 0 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Template is required to send emails. Save as draft to add one later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Edit Email Modal Component
const EditEmailModal = ({
  email,
  templates,
  onSave,
  onClose,
  isLoading,
}) => {
  const [subject, setSubject] = useState(email?.subject || '');
  const [body, setBody] = useState(email?.body || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const emailTemplates = Array.isArray(templates) ? templates.filter(t => t.type === 'email') : [];

  // Apply template to email
  const handleApplyTemplate = () => {
    if (!selectedTemplateId) return;
    const template = emailTemplates.find(t => t.id === parseInt(selectedTemplateId));
    if (template) {
      setSubject(template.subject || '');
      // Personalize the template content with prospect data
      let content = template.content || '';
      if (email?.prospect) {
        const firstName = email.prospect.full_name?.split(' ')[0] || '';
        const lastName = email.prospect.full_name?.split(' ').slice(1).join(' ') || '';
        content = content
          .replace(/{firstName}/g, firstName)
          .replace(/{lastName}/g, lastName)
          .replace(/{fullName}/g, email.prospect.full_name || '')
          .replace(/{email}/g, email.prospect.email || email.to_email || '')
          .replace(/{company}/g, email.prospect.company || '')
          .replace(/{headline}/g, email.prospect.headline || '')
          .replace(/{location}/g, email.prospect.location || '');
      }
      setBody(content);
    }
  };

  const handleSave = () => {
    onSave({ subject, body });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Edit Email</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XIcon />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            To: {email?.prospect?.full_name || email?.to_email}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[55vh] space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apply Template
            </label>
            <div className="flex space-x-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
              placeholder="Enter email subject..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none"
              placeholder="Enter your email message..."
            />
          </div>

          {/* Personalization Hint */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <strong>Tip:</strong> Use placeholders like {'{firstName}'}, {'{lastName}'}, {'{fullName}'}, {'{company}'}, {'{headline}'} in templates for personalization.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !subject.trim() || !body.trim()}
          >
            {isLoading ? <Spinner size="sm" /> : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Create Email Modal Component
const CreateEmailModal = ({
  templates,
  onSave,
  onClose,
  isLoading,
}) => {
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const emailTemplates = Array.isArray(templates) ? templates.filter(t => t.type === 'email') : [];

  // Apply template
  const handleApplyTemplate = () => {
    if (!selectedTemplateId) return;
    const template = emailTemplates.find(t => t.id === parseInt(selectedTemplateId));
    if (template) {
      setSubject(template.subject || '');
      setBody(template.content || '');
    }
  };

  const handleSave = () => {
    onSave({ to_email: toEmail, subject, body });
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-linkedin text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <PlusIcon />
              <h3 className="text-lg font-semibold">New Email</h3>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[55vh] space-y-4">
          {/* Recipient Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
              placeholder="recipient@example.com"
            />
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apply Template (Optional)
            </label>
            <div className="flex space-x-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
              >
                <option value="">Select a template...</option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent"
              placeholder="Enter email subject..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none"
              placeholder="Enter your email message..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !isValidEmail(toEmail) || !subject.trim() || !body.trim()}
          >
            {isLoading ? <Spinner size="sm" /> : 'Create Email'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Mail = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showExtractionModal, setShowExtractionModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingEmail, setEditingEmail] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: mailsData, isLoading, error } = useMails({
    status: status || undefined,
    search: search || undefined,
    page,
    per_page: 20,
  });

  const { data: stats, isLoading: statsLoading } = useMailStats();
  const { data: pendingExtractions } = usePendingExtractions();
  const { data: templatesData } = useTemplates('email');
  const queueMutation = useQueueFromCampaign();
  const discardMutation = useDiscardExtraction();
  const sendEmailMutation = useSendEmail();
  const sendBulkMutation = useSendBulk();
  const deleteEmailMutation = useDeleteEmail();
  const deleteBulkMutation = useDeleteBulk();
  const updateEmailMutation = useUpdateEmail();
  const createEmailMutation = useCreateEmail();

  // Show modal when there are pending extractions
  useEffect(() => {
    if (pendingExtractions?.campaigns?.length > 0 && !showExtractionModal && !selectedCampaign) {
      setSelectedCampaign(pendingExtractions.campaigns[0]);
      setShowExtractionModal(true);
    }
  }, [pendingExtractions, showExtractionModal, selectedCampaign]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleStatusFilter = (newStatus) => {
    setStatus(newStatus);
    setPage(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const handleSendNow = async (templateId) => {
    if (!selectedCampaign) return;
    if (!templateId) {
      console.error('Template is required to send emails');
      return;
    }

    try {
      await queueMutation.mutateAsync({
        campaignId: selectedCampaign.id,
        templateId: parseInt(templateId),
        sendNow: true,
      });
      setShowExtractionModal(false);
      setSelectedCampaign(null);
    } catch (error) {
      console.error('Failed to send emails:', error);
    }
  };

  const handleSendLater = async (templateId) => {
    if (!selectedCampaign) return;

    try {
      await queueMutation.mutateAsync({
        campaignId: selectedCampaign.id,
        templateId: templateId ? parseInt(templateId) : null,
        sendNow: false,
      });
      setShowExtractionModal(false);
      setSelectedCampaign(null);
    } catch (error) {
      console.error('Failed to save emails:', error);
    }
  };

  const handleDiscard = async () => {
    if (!selectedCampaign) return;

    try {
      await discardMutation.mutateAsync(selectedCampaign.id);
      setShowExtractionModal(false);
      setSelectedCampaign(null);
    } catch (error) {
      console.error('Failed to discard extraction:', error);
    }
  };

  const handleCloseModal = () => {
    setShowExtractionModal(false);
    // Don't clear selectedCampaign so modal doesn't reopen immediately
  };

  // Handle edit email
  const handleEditEmail = (email, e) => {
    e.stopPropagation();
    setEditingEmail(email);
  };

  // Handle save edited email
  const handleSaveEdit = async (data) => {
    if (!editingEmail) return;
    try {
      await updateEmailMutation.mutateAsync({
        emailId: editingEmail.id,
        data,
      });
      setEditingEmail(null);
    } catch (error) {
      console.error('Failed to update email:', error);
    }
  };

  // Handle create new email
  const handleCreateEmail = async (data) => {
    try {
      await createEmailMutation.mutateAsync(data);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create email:', error);
    }
  };

  // Handle individual email send
  const handleSendSingle = async (emailId, e) => {
    e.stopPropagation(); // Prevent row click
    try {
      await sendEmailMutation.mutateAsync(emailId);
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  };

  // Handle individual email delete
  const handleDeleteSingle = async (emailId, e) => {
    e.stopPropagation(); // Prevent row click
    if (!window.confirm('Are you sure you want to delete this email?')) return;
    try {
      await deleteEmailMutation.mutateAsync(emailId);
    } catch (error) {
      console.error('Failed to delete email:', error);
    }
  };

  // Handle bulk send
  const handleBulkSend = async () => {
    if (selectedIds.length === 0) return;
    try {
      await sendBulkMutation.mutateAsync(selectedIds);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to send emails:', error);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} email(s)?`)) return;
    try {
      await deleteBulkMutation.mutateAsync(selectedIds);
      setSelectedIds([]);
    } catch (error) {
      console.error('Failed to delete emails:', error);
    }
  };

  // Handle select all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = mailsData?.data?.map(email => email.id) || [];
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  // Handle individual row checkbox
  const handleSelectRow = (emailId, e) => {
    e.stopPropagation();
    if (selectedIds.includes(emailId)) {
      setSelectedIds(selectedIds.filter(id => id !== emailId));
    } else {
      setSelectedIds([...selectedIds, emailId]);
    }
  };

  // Check if all rows are selected
  const isAllSelected = mailsData?.data?.length > 0 &&
    mailsData?.data?.every(email => selectedIds.includes(email.id));

  // Get sendable emails from selection (pending/draft/failed only)
  const sendableSelectedIds = selectedIds.filter(id => {
    const email = mailsData?.data?.find(e => e.id === id);
    return email && email.status !== 'sent';
  });

  // All selected emails can be deleted
  const deletableSelectedIds = selectedIds;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mail</h1>
            <p className="text-gray-600 mt-1">View and track your sent emails.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2"
            >
              <PlusIcon />
              <span>New Email</span>
            </Button>
            {pendingExtractions?.campaigns?.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedCampaign(pendingExtractions.campaigns[0]);
                  setShowExtractionModal(true);
                }}
                className="flex items-center space-x-2"
              >
                <BellIcon />
                <span>
                  {pendingExtractions.campaigns.length} Pending
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statsLoading ? (
            <div className="col-span-4 flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <StatsCard
                title="Total Sent"
                value={stats?.sent || 0}
                icon={<MailIcon />}
                color="blue"
              />
              <StatsCard
                title="Sent Today"
                value={stats?.today_sent || 0}
                icon={<CheckIcon />}
                color="green"
              />
              <StatsCard
                title="Failed"
                value={stats?.failed || 0}
                icon={<XIcon />}
                color="red"
              />
              <StatsCard
                title="Pending"
                value={stats?.pending || 0}
                icon={<ClockIcon />}
                color="yellow"
              />
            </>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Status Filters */}
            <div className="flex space-x-2">
              <Button
                variant={status === '' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleStatusFilter('')}
              >
                All
              </Button>
              <Button
                variant={status === 'sent' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleStatusFilter('sent')}
              >
                Sent
              </Button>
              <Button
                variant={status === 'failed' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleStatusFilter('failed')}
              >
                Failed
              </Button>
              <Button
                variant={status === 'pending' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => handleStatusFilter('pending')}
              >
                Pending
              </Button>
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex space-x-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by email or subject..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent w-64"
                />
                <div className="absolute left-3 top-2.5">
                  <SearchIcon />
                </div>
              </div>
              <Button type="submit" size="sm">
                Search
              </Button>
              {search && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSearchInput('');
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-linkedin rounded-lg p-4 flex items-center justify-between text-white">
            <span className="font-medium">{selectedIds.length} email(s) selected</span>
            <div className="flex space-x-3">
              {sendableSelectedIds.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkSend}
                  disabled={sendBulkMutation.isLoading}
                  className="bg-white text-linkedin hover:bg-gray-100"
                >
                  {sendBulkMutation.isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <SendIcon />
                      <span className="ml-1">Send ({sendableSelectedIds.length})</span>
                    </>
                  )}
                </Button>
              )}
              {deletableSelectedIds.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleteBulkMutation.isLoading}
                  className="bg-red-500 text-white hover:bg-red-600 border-red-500"
                >
                  {deleteBulkMutation.isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <TrashIcon />
                      <span className="ml-1">Delete ({deletableSelectedIds.length})</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="bg-transparent text-white hover:bg-white/10 border-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Email List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              Failed to load emails. Please try again.
            </div>
          ) : mailsData?.data?.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="w-12 h-12 mx-auto text-gray-300 mb-3">
                <MailIcon />
              </div>
              <p>No emails found.</p>
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campaign
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mailsData?.data?.map((email) => (
                    <tr
                      key={email.id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedIds.includes(email.id) ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <td className="px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(email.id)}
                          onChange={(e) => handleSelectRow(email.id, e)}
                          className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {email.prospect?.full_name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500">{email.to_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-900 truncate max-w-xs">{email.subject || '(No subject)'}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={email.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-500">
                          {email.campaign?.name || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(email.sent_at || email.created_at)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {email.status !== 'sent' && (
                            <button
                              onClick={(e) => handleEditEmail(email, e)}
                              className="p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 rounded transition-colors"
                              title="Edit email"
                            >
                              <EditIcon />
                            </button>
                          )}
                          {email.status !== 'sent' && (
                            <button
                              onClick={(e) => handleSendSingle(email.id, e)}
                              disabled={sendEmailMutation.isLoading}
                              className="p-1.5 text-linkedin hover:bg-linkedin hover:text-white rounded transition-colors disabled:opacity-50"
                              title="Send email"
                            >
                              <SendIcon />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDeleteSingle(email.id, e)}
                            disabled={deleteEmailMutation.isLoading}
                            className="p-1.5 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors disabled:opacity-50"
                            title="Delete email"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {mailsData?.meta && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {((mailsData.meta.current_page - 1) * mailsData.meta.per_page) + 1} to{' '}
                    {Math.min(mailsData.meta.current_page * mailsData.meta.per_page, mailsData.meta.total)} of{' '}
                    {mailsData.meta.total} emails
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === mailsData.meta.last_page}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Email Detail Modal */}
        {selectedEmail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Email Details</h3>
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">To</label>
                    <p className="text-gray-900">
                      {selectedEmail.prospect?.full_name} &lt;{selectedEmail.to_email}&gt;
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Subject</label>
                    <p className="text-gray-900 font-medium">{selectedEmail.subject}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Status</label>
                    <div className="mt-1">
                      <StatusBadge status={selectedEmail.status} />
                    </div>
                  </div>
                  {selectedEmail.error_message && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Error</label>
                      <p className="text-red-600 text-sm">{selectedEmail.error_message}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Message</label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedEmail.body}</p>
                    </div>
                  </div>
                  <div className="flex space-x-6 text-sm text-gray-500">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Sent At</label>
                      <p>{formatDate(selectedEmail.sent_at || selectedEmail.created_at)}</p>
                    </div>
                    {selectedEmail.campaign && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Campaign</label>
                        <p>{selectedEmail.campaign.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <Button variant="secondary" onClick={() => setSelectedEmail(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Extraction Results Modal */}
        {showExtractionModal && selectedCampaign && (
          <ExtractionResultsModal
            campaign={selectedCampaign}
            templates={templatesData?.templates || []}
            onSendNow={handleSendNow}
            onSendLater={handleSendLater}
            onDiscard={handleDiscard}
            onClose={handleCloseModal}
            isLoading={queueMutation.isLoading || discardMutation.isLoading}
          />
        )}

        {/* Edit Email Modal */}
        {editingEmail && (
          <EditEmailModal
            email={editingEmail}
            templates={templatesData?.templates || []}
            onSave={handleSaveEdit}
            onClose={() => setEditingEmail(null)}
            isLoading={updateEmailMutation.isLoading}
          />
        )}

        {/* Create Email Modal */}
        {showCreateModal && (
          <CreateEmailModal
            templates={templatesData?.templates || []}
            onSave={handleCreateEmail}
            onClose={() => setShowCreateModal(false)}
            isLoading={createEmailMutation.isLoading}
          />
        )}
      </div>
    </Layout>
  );
};

export default Mail;
