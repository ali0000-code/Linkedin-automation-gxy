/**
 * Message Templates Page
 *
 * Manage LinkedIn message templates for campaigns.
 * Two types: Direct Messages and Invitation Messages (connection request notes).
 */

import { useState } from 'react';
import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import TemplateCreateModal from '../components/templates/TemplateCreateModal';
import TemplateEditModal from '../components/templates/TemplateEditModal';
import { useTemplates, useDeleteTemplate, useBulkDeleteTemplates } from '../hooks/useTemplates';

const MessageTemplates = () => {
  const [activeType, setActiveType] = useState('invitation'); // 'invitation' or 'message'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedTemplates, setSelectedTemplates] = useState([]);

  // Fetch templates filtered by active type
  const { data, isLoading } = useTemplates(activeType);
  const templates = data?.templates || [];

  // Delete mutations
  const { mutate: deleteTemplate } = useDeleteTemplate();
  const { mutate: bulkDeleteTemplates } = useBulkDeleteTemplates();

  // Clear selection when switching template types
  const handleTypeChange = (type) => {
    setActiveType(type);
    setSelectedTemplates([]);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplate(id);
    }
  };

  const handleToggleTemplate = (id) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedTemplates.length === templates.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(templates.map((t) => t.id));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTemplates.length} template(s)?`)) {
      bulkDeleteTemplates(selectedTemplates, {
        onSuccess: () => {
          setSelectedTemplates([]);
        },
      });
    }
  };

  const templateTypes = [
    {
      id: 'invitation',
      name: 'Invitation Messages',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
      description: 'Invitation Messages are sent as a note when connecting with someone on LinkedIn. These messages have a 300 character limit.',
      emptyTitle: 'No Invitation Templates',
      emptyDescription: 'Create your first invitation message template to use in connection requests',
      buttonText: 'Create Invitation Template'
    },
    {
      id: 'message',
      name: 'Direct Messages',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      description: 'Direct Messages are sent to your existing LinkedIn connections. These can be longer and more detailed than invitation messages.',
      emptyTitle: 'No Message Templates',
      emptyDescription: 'Create your first direct message template to use in your campaigns',
      buttonText: 'Create Message Template'
    },
    {
      id: 'email',
      name: 'Email Templates',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      description: 'Email Templates are used to send emails to prospects. Requires an extracted email address and Gmail SMTP connection.',
      emptyTitle: 'No Email Templates',
      emptyDescription: 'Create your first email template to send emails to prospects',
      buttonText: 'Create Email Template'
    }
  ];

  const activeTemplateType = templateTypes.find(type => type.id === activeType);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Template Types */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Template Types</h2>
            <p className="text-sm text-gray-600 mt-1">
              Select a template type to manage
            </p>
          </div>

          {/* Template Types List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {templateTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeChange(type.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeType === type.id
                      ? 'bg-linkedin text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className={activeType === type.id ? 'text-white' : 'text-gray-500'}>
                    {type.icon}
                  </div>
                  <span className="font-medium text-left">{type.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content - Templates */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Section - Fixed */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{activeTemplateType.name}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Create and manage your {activeTemplateType.name.toLowerCase()}
                </p>
              </div>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                + New Template
              </Button>
            </div>

            {/* Info Banner */}
            <div className="mt-4">
              <div className="bg-blue-50 border-l-4 border-linkedin p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-linkedin" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>{activeTemplateType.name}</strong>: {activeTemplateType.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Templates List - Scrollable */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-white rounded-lg shadow">
                {/* Empty State */}
                <div className="text-center py-12 px-6">
                  <div className="mb-4 flex justify-center">
                    <div className="text-gray-400">
                      {activeTemplateType.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {activeTemplateType.emptyTitle}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {activeTemplateType.emptyDescription}
                  </p>
                  <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                    {activeTemplateType.buttonText}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Bulk Actions Bar */}
                {templates.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.length === templates.length && templates.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-700">
                          Select All ({templates.length})
                        </span>
                      </label>
                      {selectedTemplates.length > 0 && (
                        <Button variant="danger" onClick={handleBulkDelete}>
                          Delete Selected ({selectedTemplates.length})
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Templates List */}
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start space-x-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(template.id)}
                          onChange={() => handleToggleTemplate(template.id)}
                          className="mt-1 w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                        />

                        {/* Template Content */}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {template.name}
                          </h3>
                          {template.type === 'email' && template.subject && (
                            <div className="mb-2 px-3 py-1 bg-purple-50 rounded-lg inline-block">
                              <span className="text-sm text-purple-700">
                                <strong>Subject:</strong> {template.subject}
                              </span>
                            </div>
                          )}
                          <p className="text-gray-700 whitespace-pre-wrap break-words">
                            {template.content}
                          </p>
                          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                            <span>{template.content.length} characters</span>
                            <span>•</span>
                            <span>
                              Created {new Date(template.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="text-linkedin hover:text-linkedin-dark p-2 rounded transition-colors"
                            title="Edit template"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="text-red-600 hover:text-red-700 p-2 rounded transition-colors"
                            title="Delete template"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      <TemplateCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        type={activeType}
      />

      {/* Edit Template Modal */}
      <TemplateEditModal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        template={editingTemplate}
      />
    </Layout>
  );
};

export default MessageTemplates;
