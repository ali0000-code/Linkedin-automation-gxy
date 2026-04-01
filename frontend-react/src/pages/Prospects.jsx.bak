/**
 * Prospects Page
 *
 * Main prospects management page with filters, stats, and table.
 */

import { useState } from 'react';
import { useProspects, useDeleteProspect } from '../hooks/useProspects';
import Layout from '../components/layout/Layout';
import ProspectStats from '../components/prospects/ProspectStats';
import ProspectFilters from '../components/prospects/ProspectFilters';
import ProspectTable from '../components/prospects/ProspectTable';
import ProspectEditModal from '../components/prospects/ProspectEditModal';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
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
  const [deletingProspect, setDeletingProspect] = useState(null);

  // Fetch prospects with current filters
  const { data: prospectsData, isLoading, error } = useProspects(filters);
  const deleteMutation = useDeleteProspect();

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
   * Handle page change
   */
  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
   * Handle delete with confirmation
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

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">My Prospects</h1>
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
            <ProspectTable
              prospects={prospects}
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
      </div>
    </Layout>
  );
};

export default Prospects;
