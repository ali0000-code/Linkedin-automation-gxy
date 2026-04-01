/**
 * Prospects Page
 *
 * Main prospects management page with filters, stats, and table.
 * Supports bulk selection, deletion, and tag assignment.
 * Selection persists across pagination.
 */

import { useState } from 'react';
import { useProspects, useDeleteProspect, useBulkDeleteProspects, useBulkAttachTags } from '../hooks/useProspects';
import { useTags } from '../hooks/useTags';
import { useUIStore } from '../store/uiStore';
import Layout from '../components/layout/Layout';
import ProspectStats from '../components/prospects/ProspectStats';
import ProspectFilters from '../components/prospects/ProspectFilters';
import ProspectTable from '../components/prospects/ProspectTable';
import ProspectEditModal from '../components/prospects/ProspectEditModal';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { PAGINATION } from '../utils/constants';

const Prospects = () => {
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    connection_status: '',
    tag_id: '',
    page: 1,
    per_page: PAGINATION.DEFAULT_PER_PAGE
  });

  // Modal state
  const [editingProspect, setEditingProspect] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Global selection state (persists across pagination)
  const selectedProspects = useUIStore((state) => state.selectedProspects);
  const toggleProspect = useUIStore((state) => state.toggleProspect);
  const setSelectedProspects = useUIStore((state) => state.setSelectedProspects);
  const clearSelectedProspects = useUIStore((state) => state.clearSelectedProspects);

  // Fetch prospects with current filters
  const { data: prospectsData, isLoading, error } = useProspects(filters);
  const deleteMutation = useDeleteProspect();
  const bulkDeleteMutation = useBulkDeleteProspects();
  const bulkAttachTagsMutation = useBulkAttachTags();

  // Fetch tags for bulk tag assignment
  const { data: tagsData } = useTags();
  const tags = Array.isArray(tagsData) ? tagsData : [];

  const prospects = prospectsData?.data || [];
  const meta = prospectsData?.meta || {};

  /**
   * Handle filter change (for all filters including search)
   */
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setFilters({
      search: '',
      connection_status: '',
      tag_id: '',
      page: 1,
      per_page: PAGINATION.DEFAULT_PER_PAGE
    });
  };

  /**
   * Handle page change (selection persists)
   */
  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Toggle prospect selection
   */
  const handleToggleProspect = (prospectId) => {
    toggleProspect(prospectId);
  };

  /**
   * Select all prospects on current page
   */
  const handleSelectAllOnPage = () => {
    const currentPageIds = prospects.map((p) => p.id);
    const allSelected = currentPageIds.every((id) => selectedProspects.includes(id));

    if (allSelected) {
      // Deselect all on current page
      setSelectedProspects(selectedProspects.filter((id) => !currentPageIds.includes(id)));
    } else {
      // Select all on current page
      const newSelection = [...selectedProspects];
      currentPageIds.forEach((id) => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      setSelectedProspects(newSelection);
    }
  };

  /**
   * Open edit modal
   */
  const handleEdit = (prospect) => {
    setEditingProspect(prospect);
    setIsEditModalOpen(true);
  };

  /**
   * Close edit modal
   */
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingProspect(null);
  };

  /**
   * Handle single delete with confirmation
   */
  const handleDelete = async (prospect) => {
    if (window.confirm(`Are you sure you want to delete ${prospect.full_name}?`)) {
      try {
        await deleteMutation.mutateAsync(prospect.id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  /**
   * Handle bulk delete with confirmation
   */
  const handleBulkDelete = async () => {
    if (selectedProspects.length === 0) return;

    const count = selectedProspects.length;
    if (window.confirm(`Are you sure you want to delete ${count} prospect${count > 1 ? 's' : ''}?`)) {
      try {
        await bulkDeleteMutation.mutateAsync(selectedProspects);
        clearSelectedProspects();
      } catch (error) {
        console.error('Bulk delete error:', error);
      }
    }
  };

  /**
   * Open bulk tag assignment modal
   */
  const handleOpenBulkTagModal = () => {
    setSelectedTagIds([]);
    setIsBulkTagModalOpen(true);
  };

  /**
   * Handle bulk tag assignment
   */
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

  /**
   * Toggle tag selection for bulk assignment
   */
  const handleToggleTag = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Check if all prospects on current page are selected
  const currentPageIds = prospects.map((p) => p.id);
  const allOnPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedProspects.includes(id));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">My Prospects</h1>
          {selectedProspects.length > 0 && (
            <div className="flex space-x-2">
              <Button variant="primary" onClick={handleOpenBulkTagModal}>
                Assign Tags ({selectedProspects.length})
              </Button>
              <Button variant="danger" onClick={handleBulkDelete}>
                Delete Selected ({selectedProspects.length})
              </Button>
              <Button variant="secondary" onClick={clearSelectedProspects}>
                Clear Selection
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <ProspectStats />

        {/* Filters */}
        <ProspectFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Error loading prospects: {error.message}
          </div>
        )}

        {/* Prospects Table */}
        {!isLoading && !error && (
          <>
            {/* Selection Info Bar */}
            {selectedProspects.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                <div className="text-sm text-blue-800">
                  <strong>{selectedProspects.length}</strong> prospect{selectedProspects.length > 1 ? 's' : ''} selected across all pages
                </div>
              </div>
            )}

            {/* Select All Header */}
            {prospects.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={handleSelectAllOnPage}
                    className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    Select All on This Page ({currentPageIds.length})
                  </span>
                </label>
              </div>
            )}

            <ProspectTable
              prospects={prospects}
              selectedProspects={selectedProspects}
              onToggleProspect={handleToggleProspect}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />

            {/* Pagination */}
            {meta.last_page > 1 && (
              <div className="flex items-center justify-between bg-white rounded-lg shadow px-6 py-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{meta.from || 0}</span> to{' '}
                  <span className="font-medium">{meta.to || 0}</span> of{' '}
                  <span className="font-medium">{meta.total || 0}</span> results
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(meta.current_page - 1)}
                    disabled={meta.current_page === 1}
                  >
                    Previous
                  </Button>

                  {/* Page Numbers */}
                  <div className="flex space-x-1">
                    {[...Array(meta.last_page)].map((_, i) => {
                      const page = i + 1;
                      // Show first, last, current, and adjacent pages
                      if (
                        page === 1 ||
                        page === meta.last_page ||
                        (page >= meta.current_page - 1 && page <= meta.current_page + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              page === meta.current_page
                                ? 'bg-linkedin text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === meta.current_page - 2 || page === meta.current_page + 2) {
                        return <span key={page} className="px-2">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(meta.current_page + 1)}
                    disabled={meta.current_page === meta.last_page}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit Modal */}
        {editingProspect && (
          <ProspectEditModal
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
            prospect={editingProspect}
          />
        )}

        {/* Bulk Tag Assignment Modal */}
        <Modal
          isOpen={isBulkTagModalOpen}
          onClose={() => setIsBulkTagModalOpen(false)}
          title={`Assign Tags to ${selectedProspects.length} Prospect${selectedProspects.length > 1 ? 's' : ''}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select tags to assign to the selected prospects. Tags will be added without removing existing ones.
            </p>

            {/* Tag List */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {tags.length === 0 ? (
                <p className="text-gray-500 text-sm">No tags available. Create tags first.</p>
              ) : (
                tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => handleToggleTag(tag.id)}
                      className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                    />
                    <div
                      className="w-4 h-4 rounded-full ml-3"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-900">{tag.name}</span>
                  </label>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setIsBulkTagModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkAttachTags}
                disabled={selectedTagIds.length === 0}
                loading={bulkAttachTagsMutation.isPending}
              >
                Assign Tags
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default Prospects;
