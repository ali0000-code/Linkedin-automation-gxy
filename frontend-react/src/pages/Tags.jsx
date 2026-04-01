/**
 * Tags Page
 *
 * Tag management page - create, edit, delete tags.
 * Supports bulk selection and deletion.
 * Click on tag to view associated prospects.
 */

import { useState } from 'react';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../hooks/useTags';
import { useProspects } from '../hooks/useProspects';
import { TAG_COLORS } from '../utils/constants';
import { getErrorMessage } from '../utils/helpers';
import Layout from '../components/layout/Layout';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

const Tags = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({ name: '', color: TAG_COLORS[0] });
  const [error, setError] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [viewingTag, setViewingTag] = useState(null);

  const { data: tagsData, isLoading } = useTags();
  const tags = Array.isArray(tagsData) ? tagsData : [];
  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();

  // Fetch prospects for the viewed tag
  const { data: prospectsData, isLoading: prospectsLoading } = useProspects(
    viewingTag ? { tag_id: viewingTag.id, per_page: 100 } : {},
    { enabled: !!viewingTag }
  );
  const tagProspects = prospectsData?.data || [];

  /**
   * Toggle tag selection
   */
  const handleToggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  /**
   * Select all tags
   */
  const handleSelectAll = () => {
    if (selectedTags.length === tags.length) {
      setSelectedTags([]);
    } else {
      setSelectedTags(tags.map((tag) => tag.id));
    }
  };

  /**
   * Bulk delete selected tags
   */
  const handleBulkDelete = async () => {
    if (selectedTags.length === 0) return;

    const count = selectedTags.length;
    if (window.confirm(`Are you sure you want to delete ${count} tag${count > 1 ? 's' : ''}? This will remove them from all prospects.`)) {
      try {
        // Delete tags sequentially
        for (const tagId of selectedTags) {
          await deleteMutation.mutateAsync(tagId);
        }
        setSelectedTags([]);
      } catch (error) {
        console.error('Bulk delete error:', error);
      }
    }
  };

  /**
   * Open modal for creating tag
   */
  const handleCreate = () => {
    setEditingTag(null);
    setFormData({ name: '', color: TAG_COLORS[0] });
    setError('');
    setIsModalOpen(true);
  };

  /**
   * Open modal for editing tag
   */
  const handleEdit = (tag, e) => {
    e.stopPropagation(); // Prevent viewing prospects when editing
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color || TAG_COLORS[0] });
    setError('');
    setIsModalOpen(true);
  };

  /**
   * Handle form submission (create or update)
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name) {
      setError('Tag name is required');
      return;
    }

    try {
      if (editingTag) {
        await updateMutation.mutateAsync({ id: editingTag.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Tag save error:', err);
      setError(getErrorMessage(err));
    }
  };

  /**
   * Handle tag deletion with confirmation
   */
  const handleDelete = async (tag, e) => {
    e.stopPropagation(); // Prevent viewing prospects when deleting
    if (window.confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all prospects.`)) {
      try {
        await deleteMutation.mutateAsync(tag.id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  /**
   * View prospects for a tag
   */
  const handleViewTag = (tag) => {
    setViewingTag(tag);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tags</h1>
            <p className="mt-1 text-sm text-gray-600">
              Organize your prospects with custom tags
            </p>
          </div>
          <div className="flex space-x-2">
            {selectedTags.length > 0 && (
              <Button variant="danger" onClick={handleBulkDelete}>
                Delete Selected ({selectedTags.length})
              </Button>
            )}
            <Button variant="primary" onClick={handleCreate}>
              Create Tag
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Tags List */}
        {!isLoading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {tags.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No tags yet. Create your first tag!</p>
              </div>
            ) : (
              <>
                {/* Select All Header */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTags.length === tags.length && tags.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                  />
                  <label className="ml-3 text-sm font-medium text-gray-700">
                    Select All ({tags.length})
                  </label>
                </div>

                {/* Tags */}
                <div className="divide-y divide-gray-200">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer"
                      onClick={() => handleViewTag(tag)}
                    >
                      <div className="flex items-center space-x-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={() => handleToggleTag(tag.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                        />

                        {/* Color Indicator */}
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />

                        {/* Tag Info */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{tag.name}</h3>
                          <p className="text-sm text-gray-500">
                            {tag.prospects_count || 0} {tag.prospects_count === 1 ? 'prospect' : 'prospects'}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEdit(tag, e)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => handleDelete(tag, e)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Create/Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingTag ? 'Edit Tag' : 'Create Tag'}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Tag Name */}
            <Input
              label="Tag Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Hot Lead, CEO, Marketing"
              required
            />

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag Color
              </label>
              <div className="grid grid-cols-8 gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      formData.color === color ? 'ring-2 ring-offset-2 ring-linkedin scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingTag ? 'Update Tag' : 'Create Tag'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* View Tag Prospects Modal */}
        <Modal
          isOpen={!!viewingTag}
          onClose={() => setViewingTag(null)}
          title={viewingTag ? `Prospects with "${viewingTag.name}"` : ''}
          size="lg"
        >
          {prospectsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : tagProspects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No prospects with this tag yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tagProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{prospect.full_name}</h3>
                      {prospect.profile_url && (
                        <a
                          href={prospect.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-linkedin hover:underline"
                        >
                          View Profile
                        </a>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        prospect.connection_status === 'connected'
                          ? 'bg-green-100 text-green-800'
                          : prospect.connection_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {prospect.connection_status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
};

export default Tags;
