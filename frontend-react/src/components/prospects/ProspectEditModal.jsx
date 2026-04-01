/**
 * ProspectEditModal Component
 *
 * Modal for editing prospect details and managing tags.
 */

import { useState, useEffect } from 'react';
import { useUpdateProspect, useAttachTags } from '../../hooks/useProspects';
import { useTags } from '../../hooks/useTags';
import { CONNECTION_STATUS, CONNECTION_STATUS_LABELS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/helpers';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Tag from '../common/Tag';

/**
 * Prospect edit modal component
 * @param {object} props - Component props
 * @param {boolean} props.isOpen - Modal open state
 * @param {function} props.onClose - Close callback
 * @param {object} props.prospect - Prospect to edit
 */
const ProspectEditModal = ({ isOpen, onClose, prospect }) => {
  const [formData, setFormData] = useState({
    connection_status: CONNECTION_STATUS.NOT_CONNECTED
  });
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [error, setError] = useState('');

  const updateMutation = useUpdateProspect();
  const attachTagsMutation = useAttachTags();
  const { data: tagsData } = useTags();
  const availableTags = Array.isArray(tagsData) ? tagsData : [];

  // Initialize form data when prospect changes
  useEffect(() => {
    if (prospect) {
      setFormData({
        connection_status: prospect.connection_status || CONNECTION_STATUS.NOT_CONNECTED
      });

      // Set currently attached tag IDs
      const currentTagIds = prospect.tags?.map(t => t.id) || [];
      setSelectedTagIds(currentTagIds);
    }
  }, [prospect]);

  /**
   * Handle form field change
   */
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Toggle tag selection
   */
  const toggleTag = (tagId) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Update prospect details
      await updateMutation.mutateAsync({
        id: prospect.id,
        data: formData
      });

      // Update tags if changed
      const currentTagIds = prospect.tags?.map(t => t.id) || [];
      const tagsChanged = JSON.stringify(currentTagIds.sort()) !== JSON.stringify(selectedTagIds.sort());

      if (tagsChanged && selectedTagIds.length > 0) {
        await attachTagsMutation.mutateAsync({
          prospectId: prospect.id,
          tagIds: selectedTagIds
        });
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Prospect" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Full Name - Read Only */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={prospect?.full_name || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* Connection Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Connection Status
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-linkedin"
            value={formData.connection_status}
            onChange={(e) => handleChange('connection_status', e.target.value)}
          >
            {Object.values(CONNECTION_STATUS).map(status => (
              <option key={status} value={status}>
                {CONNECTION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {/* Tags Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-linkedin text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={isSelected ? {} : { borderColor: tag.color }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          {availableTags.length === 0 && (
            <p className="text-sm text-gray-500">No tags available. Create tags first.</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={updateMutation.isPending || attachTagsMutation.isPending}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ProspectEditModal;
