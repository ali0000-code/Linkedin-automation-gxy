/**
 * ProspectFilters Component
 *
 * Filters bar for prospects list (search, connection status, tags).
 */

import { useTags } from '../../hooks/useTags';
import { CONNECTION_STATUS, CONNECTION_STATUS_LABELS } from '../../utils/constants';
import Input from '../common/Input';

/**
 * Prospect filters component
 * @param {object} props - Component props
 * @param {object} props.filters - Current filter values
 * @param {function} props.onFilterChange - Filter change callback
 * @param {function} props.onClearFilters - Clear filters callback
 */
const ProspectFilters = ({ filters, onFilterChange, onClearFilters }) => {
  const { data: tagsData, isLoading: tagsLoading } = useTags();
  const tags = Array.isArray(tagsData) ? tagsData : [];

  const hasActiveFilters = filters.search || filters.connection_status || filters.tag_id;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="md:col-span-2">
          <Input
            type="text"
            placeholder="Search by name, company, or headline..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange('search', e.target.value)}
          />
        </div>

        {/* Connection Status Filter */}
        <div>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin focus:border-linkedin"
            value={filters.connection_status || ''}
            onChange={(e) => onFilterChange('connection_status', e.target.value)}
          >
            <option value="">All Status</option>
            {Object.values(CONNECTION_STATUS).map((status) => (
              <option key={status} value={status}>
                {CONNECTION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-linkedin focus:border-linkedin"
            value={filters.tag_id || ''}
            onChange={(e) => onFilterChange('tag_id', e.target.value)}
          >
            <option value="">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name} ({tag.prospects_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClearFilters}
            className="text-sm text-linkedin hover:text-linkedin-dark font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default ProspectFilters;
