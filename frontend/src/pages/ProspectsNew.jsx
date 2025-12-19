/**
 * Prospects Page (New Design)
 *
 * Merged view with Tags on left sidebar and Prospects table on right.
 * Supports bulk operations on both tags and prospects.
 * Uses "Load More" instead of pagination.
 */

import { useState, useEffect, useMemo } from 'react';
import { useProspects, useDeleteProspect, useBulkDeleteProspects, useBulkAttachTags } from '../hooks/useProspects';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '../hooks/useTags';
import { useUIStore } from '../store/uiStore';
import { TAG_COLORS, PAGINATION, CONNECTION_STATUS } from '../utils/constants';
import { getErrorMessage } from '../utils/helpers';
import Layout from '../components/layout/Layout';
import ProspectTable from '../components/prospects/ProspectTable';
import ProspectEditModal from '../components/prospects/ProspectEditModal';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

const ProspectsNew = () => {
  // Prospects state
  const [filters, setFilters] = useState({
    search: '',
    connection_status: '',
    tag_id: '',
    page: 1,
    per_page: PAGINATION.DEFAULT_PER_PAGE
  });
  const [accumulatedProspects, setAccumulatedProspects] = useState([]);
  const [editingProspect, setEditingProspect] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Tags state
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagFormData, setTagFormData] = useState({ name: '', color: TAG_COLORS[0] });
  const [tagError, setTagError] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Global prospect selection
  const selectedProspects = useUIStore((state) => state.selectedProspects);
  const toggleProspect = useUIStore((state) => state.toggleProspect);
  const setSelectedProspects = useUIStore((state) => state.setSelectedProspects);
  const clearSelectedProspects = useUIStore((state) => state.clearSelectedProspects);

  // Fetch data
  const { data: prospectsData, isLoading: prospectsLoading } = useProspects(filters);
  const { data: tagsData, isLoading: tagsLoading } = useTags();

  // Mutations
  const deleteMutation = useDeleteProspect();
  const bulkDeleteMutation = useBulkDeleteProspects();
  const bulkAttachTagsMutation = useBulkAttachTags();
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  const deleteTagMutation = useDeleteTag();

  const prospects = useMemo(() => prospectsData?.data || [], [prospectsData?.data]);
  const meta = prospectsData?.meta || {};
  const tags = useMemo(() => Array.isArray(tagsData) ? tagsData : [], [tagsData]);

  // Accumulate prospects as we load more pages
  useEffect(() => {
    if (filters.page === 1) {
      // Reset on filter change or first load
      setAccumulatedProspects(prospects);
    } else if (prospects.length > 0) {
      // Append new prospects when loading more
      setAccumulatedProspects(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newProspects = prospects.filter(p => !existingIds.has(p.id));
        return [...prev, ...newProspects];
      });
    }
  }, [prospects, filters.page]);

  // Reset to page 1 when filters change (except page)
  const resetFilters = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    setAccumulatedProspects([]);
  };

  // ============ PROSPECT HANDLERS ============

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1
    }));
    setAccumulatedProspects([]);
  };

  const handleLoadMore = () => {
    setFilters(prev => ({ ...prev, page: prev.page + 1 }));
  };

  const handleToggleProspect = (prospectId) => {
    toggleProspect(prospectId);
  };

  const handleSelectAllLoaded = () => {
    const loadedIds = accumulatedProspects.map((p) => p.id);
    const allSelected = loadedIds.every((id) => selectedProspects.includes(id));

    if (allSelected) {
      setSelectedProspects(selectedProspects.filter((id) => !loadedIds.includes(id)));
    } else {
      const newSelection = [...selectedProspects];
      loadedIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      setSelectedProspects(newSelection);
    }
  };

  const handleEdit = (prospect) => {
    setEditingProspect(prospect);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (prospect) => {
    if (window.confirm(`Are you sure you want to delete ${prospect.full_name}?`)) {
      try {
        await deleteMutation.mutateAsync(prospect.id);
        // Remove from accumulated list
        setAccumulatedProspects(prev => prev.filter(p => p.id !== prospect.id));
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProspects.length === 0) return;
    const count = selectedProspects.length;
    if (window.confirm(`Are you sure you want to delete ${count} prospect${count > 1 ? 's' : ''}?`)) {
      try {
        await bulkDeleteMutation.mutateAsync(selectedProspects);
        // Remove from accumulated list
        setAccumulatedProspects(prev => prev.filter(p => !selectedProspects.includes(p.id)));
        clearSelectedProspects();
      } catch (error) {
        console.error('Bulk delete error:', error);
      }
    }
  };

  const handleOpenBulkTagModal = () => {
    setSelectedTagIds([]);
    setIsBulkTagModalOpen(true);
  };

  const handleBulkAttachTags = async () => {
    if (selectedProspects.length === 0 || selectedTagIds.length === 0) return;
    try {
      await bulkAttachTagsMutation.mutateAsync({
        prospectIds: selectedProspects,
        tagIds: selectedTagIds
      });
      setIsBulkTagModalOpen(false);
      setSelectedTagIds([]);
      clearSelectedProspects();
    } catch (error) {
      console.error('Bulk attach tags error:', error);
    }
  };

  const handleToggleTagForAssignment = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // ============ TAG HANDLERS ============

  const handleCreateTag = () => {
    setEditingTag(null);
    setTagFormData({ name: '', color: TAG_COLORS[0] });
    setTagError('');
    setIsTagModalOpen(true);
  };

  const handleEditTag = (tag, e) => {
    e.stopPropagation();
    setEditingTag(tag);
    setTagFormData({ name: tag.name, color: tag.color || TAG_COLORS[0] });
    setTagError('');
    setIsTagModalOpen(true);
  };

  const handleTagSubmit = async (e) => {
    e.preventDefault();
    setTagError('');

    if (!tagFormData.name) {
      setTagError('Tag name is required');
      return;
    }

    try {
      if (editingTag) {
        await updateTagMutation.mutateAsync({ id: editingTag.id, data: tagFormData });
      } else {
        await createTagMutation.mutateAsync(tagFormData);
      }
      setIsTagModalOpen(false);
    } catch (err) {
      console.error('Tag save error:', err);
      setTagError(getErrorMessage(err));
    }
  };

  const handleDeleteTag = async (tag, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      try {
        await deleteTagMutation.mutateAsync(tag.id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const handleToggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSelectAllTags = () => {
    if (selectedTags.length === tags.length) {
      setSelectedTags([]);
    } else {
      setSelectedTags(tags.map((tag) => tag.id));
    }
  };

  const handleBulkDeleteTags = async () => {
    if (selectedTags.length === 0) return;
    const count = selectedTags.length;
    if (window.confirm(`Are you sure you want to delete ${count} tag${count > 1 ? 's' : ''}?`)) {
      try {
        for (const tagId of selectedTags) {
          await deleteTagMutation.mutateAsync(tagId);
        }
        setSelectedTags([]);
      } catch (error) {
        console.error('Bulk delete error:', error);
      }
    }
  };

  const handleFilterByTag = (tagId) => {
    setFilters(prev => ({ ...prev, tag_id: tagId === prev.tag_id ? '' : tagId, page: 1 }));
    setAccumulatedProspects([]);
  };

  const loadedIds = accumulatedProspects.map((p) => p.id);
  const allLoadedSelected = loadedIds.length > 0 && loadedIds.every((id) => selectedProspects.includes(id));
  const hasMore = meta.current_page < meta.last_page;

  return (
    <Layout>
      <div className="flex gap-6 h-full">
        {/* LEFT SIDEBAR - TAGS */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow h-full flex flex-col">
            {/* Tags Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Tags</h2>
                <Button variant="primary" size="sm" onClick={handleCreateTag}>
                  + New
                </Button>
              </div>
              {selectedTags.length > 0 && (
                <Button variant="danger" size="sm" onClick={handleBulkDeleteTags} className="w-full">
                  Delete ({selectedTags.length})
                </Button>
              )}
            </div>

            {/* Tags List */}
            <div className="flex-1 overflow-y-auto">
              {tagsLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : tags.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No tags yet. Create one!
                </div>
              ) : (
                <div className="p-2">
                  {/* Select All */}
                  <label className="flex items-center px-3 py-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTags.length === tags.length && tags.length > 0}
                      onChange={handleSelectAllTags}
                      className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Select All</span>
                  </label>

                  {/* Tag Items */}
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`flex items-center justify-between px-3 py-2 rounded hover:bg-gray-50 cursor-pointer ${
                        filters.tag_id === tag.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleFilterByTag(tag.id)}
                    >
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={() => handleToggleTag(tag.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{tag.name}</p>
                          <p className="text-xs text-gray-500">{tag.prospects_count || 0} prospects</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => handleEditTag(tag, e)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteTag(tag, e)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT - PROSPECTS */}
        <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
          {/* Fixed Header Section */}
          <div className="space-y-4 flex-shrink-0">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {meta.total || 0} total prospects
                  {filters.tag_id && tags.find(t => t.id === parseInt(filters.tag_id))?.name &&
                    ` • Filtered by "${tags.find(t => t.id === parseInt(filters.tag_id)).name}"`}
                </p>
              </div>
              {selectedProspects.length > 0 && (
                <div className="flex space-x-2">
                  <Button variant="primary" onClick={handleOpenBulkTagModal} size="sm">
                    Assign Tags ({selectedProspects.length})
                  </Button>
                  <Button variant="danger" onClick={handleBulkDelete} size="sm">
                    Delete ({selectedProspects.length})
                  </Button>
                  <Button variant="secondary" onClick={clearSelectedProspects} size="sm">
                    Clear
                  </Button>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="grid grid-cols-3 gap-4">
                <Input
                  placeholder="Search prospects..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
                <select
                  value={filters.connection_status}
                  onChange={(e) => handleFilterChange('connection_status', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-linkedin focus:border-linkedin"
                >
                  <option value="">All Statuses</option>
                  <option value={CONNECTION_STATUS.NOT_CONNECTED}>Not Connected</option>
                  <option value={CONNECTION_STATUS.PENDING}>Pending</option>
                  <option value={CONNECTION_STATUS.CONNECTED}>Connected</option>
                </select>
                {filters.tag_id && (
                  <Button variant="secondary" onClick={() => handleFilterChange('tag_id', '')} size="sm">
                    Clear Tag Filter
                  </Button>
                )}
              </div>
            </div>

            {/* Selection Info */}
            {selectedProspects.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>{selectedProspects.length}</strong> prospect{selectedProspects.length > 1 ? 's' : ''} selected
                </p>
              </div>
            )}

            {/* Select All Loaded */}
            {accumulatedProspects.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allLoadedSelected}
                    onChange={handleSelectAllLoaded}
                    className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    Select All Loaded ({accumulatedProspects.length})
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Scrollable Prospects List */}
          <div className="flex-1 overflow-y-auto mt-4">
            {prospectsLoading && filters.page === 1 ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="space-y-4">
                <ProspectTable
                  prospects={accumulatedProspects}
                  selectedProspects={selectedProspects}
                  onToggleProspect={handleToggleProspect}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />

                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center py-6">
                    <Button
                      variant="secondary"
                      onClick={handleLoadMore}
                      loading={prospectsLoading}
                      disabled={prospectsLoading}
                    >
                      {prospectsLoading ? 'Loading...' : `Load More (${meta.total - accumulatedProspects.length} remaining)`}
                    </Button>
                  </div>
                )}

                {/* End of list message */}
                {!hasMore && accumulatedProspects.length > 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    You've reached the end of the list
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {editingProspect && (
        <ProspectEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          prospect={editingProspect}
        />
      )}

      <Modal
        isOpen={isBulkTagModalOpen}
        onClose={() => setIsBulkTagModalOpen(false)}
        title="Assign Tags"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Select tags to assign:</p>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => handleToggleTagForAssignment(tag.id)}
                  className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                />
                <div className="w-4 h-4 rounded-full ml-3" style={{ backgroundColor: tag.color }} />
                <span className="ml-2 text-sm font-medium">{tag.name}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setIsBulkTagModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleBulkAttachTags} disabled={selectedTagIds.length === 0}>
              Assign Tags
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={editingTag ? 'Edit Tag' : 'Create Tag'}
        size="md"
      >
        <form onSubmit={handleTagSubmit} className="space-y-4">
          {tagError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{tagError}</div>
          )}
          <Input
            label="Tag Name"
            value={tagFormData.name}
            onChange={(e) => setTagFormData({ ...tagFormData, name: e.target.value })}
            placeholder="e.g., Hot Lead, CEO"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="grid grid-cols-8 gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTagFormData({ ...tagFormData, color })}
                  className={`w-8 h-8 rounded-full ${tagFormData.color === color ? 'ring-2 ring-offset-2 ring-linkedin' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setIsTagModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createTagMutation.isPending || updateTagMutation.isPending}>
              {editingTag ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default ProspectsNew;
