/**
 * Template Edit Modal
 *
 * Modal for editing existing message templates (invitation, direct message, or email).
 */

import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useUpdateTemplate } from '../../hooks/useTemplates';

const TemplateEditModal = ({ isOpen, onClose, template }) => {
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
  });
  const [errors, setErrors] = useState({});

  const { mutate: updateTemplate, isPending } = useUpdateTemplate();

  // Character limits based on type
  const getMaxLength = () => {
    if (template?.type === 'invitation') return 300;
    if (template?.type === 'email') return 10000;
    return 5000;
  };
  const maxLength = getMaxLength();
  const currentLength = formData.content.length;

  // Initialize form data when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject || '',
        content: template.content,
      });
    }
  }, [template]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (template?.type === 'email' && !formData.subject.trim()) {
      newErrors.subject = 'Email subject is required';
    }
    if (!formData.content.trim()) {
      newErrors.content = 'Message content is required';
    }
    if (formData.content.length > maxLength) {
      newErrors.content = `Message must be ${maxLength} characters or less`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build payload
    const payload = {
      name: formData.name,
      content: formData.content,
    };

    // Add subject for email templates
    if (template?.type === 'email') {
      payload.subject = formData.subject;
    }

    // Update template
    updateTemplate(
      {
        id: template.id,
        data: payload,
      },
      {
        onSuccess: () => {
          // Reset form and close modal
          setFormData({ name: '', subject: '', content: '' });
          setErrors({});
          onClose();
        },
        onError: (error) => {
          // Handle API errors
          if (error.response?.data?.errors) {
            setErrors(error.response.data.errors);
          }
        },
      }
    );
  };

  const handleClose = () => {
    setFormData({ name: '', subject: '', content: '' });
    setErrors({});
    onClose();
  };

  const getTypeLabel = () => {
    if (template?.type === 'invitation') return 'Invitation Message';
    if (template?.type === 'email') return 'Email';
    return 'Direct Message';
  };

  const getPlaceholder = () => {
    if (template?.type === 'invitation') {
      return "Hi {firstName}, I'd love to connect and learn more about your work...";
    }
    if (template?.type === 'email') {
      return "Dear {firstName},\n\nI hope this email finds you well...\n\nBest regards";
    }
    return 'Write your message template here...';
  };

  const getInfoBanner = () => {
    if (template?.type === 'invitation') {
      return (
        <div className="bg-blue-50 border-l-4 border-linkedin p-3">
          <p className="text-sm text-blue-700">
            Invitation messages are sent with connection requests and have a <strong>300 character limit</strong>.
          </p>
        </div>
      );
    }
    if (template?.type === 'email') {
      return (
        <div className="bg-purple-50 border-l-4 border-purple-500 p-3">
          <p className="text-sm text-purple-700">
            Email templates require a <strong>subject line</strong>. Use personalization variables like{' '}
            <code className="bg-purple-100 px-1 rounded">{'{firstName}'}</code>,{' '}
            <code className="bg-purple-100 px-1 rounded">{'{company}'}</code>,{' '}
            <code className="bg-purple-100 px-1 rounded">{'{headline}'}</code>.
          </p>
        </div>
      );
    }
    return null;
  };

  if (!template) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Edit ${getTypeLabel()} Template`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Template Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Tech Startup Outreach"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Email Subject (only for email type) */}
        {template?.type === 'email' && (
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Email Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin ${
                errors.subject ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Quick question about {company}"
            />
            {errors.subject && <p className="text-red-500 text-sm mt-1">{errors.subject}</p>}
          </div>
        )}

        {/* Info Banner */}
        {getInfoBanner()}

        {/* Message Content */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            {template?.type === 'email' ? 'Email Body' : 'Message Content'} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows={template?.type === 'email' ? 10 : 6}
            maxLength={maxLength}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin resize-none ${
              errors.content ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={getPlaceholder()}
          />
          <div className="flex justify-between items-center mt-1">
            <div>
              {errors.content && <p className="text-red-500 text-sm">{errors.content}</p>}
            </div>
            <p
              className={`text-sm ${
                currentLength > maxLength ? 'text-red-500' : 'text-gray-500'
              }`}
            >
              {currentLength} / {maxLength}
            </p>
          </div>
        </div>

        {/* Personalization Variables Help */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 font-medium mb-1">Available Variables:</p>
          <p className="text-xs text-gray-500">
            <code className="bg-gray-200 px-1 rounded">{'{firstName}'}</code>{' '}
            <code className="bg-gray-200 px-1 rounded">{'{lastName}'}</code>{' '}
            <code className="bg-gray-200 px-1 rounded">{'{fullName}'}</code>{' '}
            <code className="bg-gray-200 px-1 rounded">{'{company}'}</code>{' '}
            <code className="bg-gray-200 px-1 rounded">{'{headline}'}</code>{' '}
            <code className="bg-gray-200 px-1 rounded">{'{location}'}</code>
            {template?.type === 'email' && <> <code className="bg-gray-200 px-1 rounded">{'{email}'}</code></>}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Updating...' : 'Update Template'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TemplateEditModal;
