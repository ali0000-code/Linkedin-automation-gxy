/**
 * ProspectTable Component
 *
 * Table display of prospects with actions (edit, delete).
 */

import { CONNECTION_STATUS_LABELS, CONNECTION_STATUS_COLORS } from '../../utils/constants';
import { getInitials } from '../../utils/helpers';
import Tag from '../common/Tag';
import Button from '../common/Button';
import { useDetachTag } from '../../hooks/useProspects';

/**
 * Prospect table component
 * @param {object} props - Component props
 * @param {array} props.prospects - Array of prospect objects
 * @param {array} props.selectedProspects - Array of selected prospect IDs
 * @param {function} props.onToggleProspect - Toggle prospect selection callback
 * @param {function} props.onEdit - Edit callback
 * @param {function} props.onDelete - Delete callback
 */
const ProspectTable = ({ prospects = [], selectedProspects = [], onToggleProspect, onEdit, onDelete }) => {
  const detachTagMutation = useDetachTag();

  /**
   * Get badge color class by connection status
   */
  const getStatusBadgeClass = (status) => {
    const colorMap = {
      [CONNECTION_STATUS_COLORS.gray]: 'bg-gray-100 text-gray-700',
      [CONNECTION_STATUS_COLORS.yellow]: 'bg-yellow-100 text-yellow-700',
      [CONNECTION_STATUS_COLORS.green]: 'bg-green-100 text-green-700',
      [CONNECTION_STATUS_COLORS.red]: 'bg-red-100 text-red-700',
    };

    return colorMap[CONNECTION_STATUS_COLORS[status]] || 'bg-gray-100 text-gray-700';
  };

  /**
   * Handle tag removal
   */
  const handleRemoveTag = async (prospectId, tagId) => {
    try {
      await detachTagMutation.mutateAsync({ prospectId, tagId });
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  if (prospects.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">No prospects found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left">
                {/* Checkbox column */}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prospect
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tags
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {prospects.map((prospect) => (
              <tr key={prospect.id} className="hover:bg-gray-50 transition-colors">
                {/* Checkbox */}
                <td className="px-3 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedProspects.includes(prospect.id)}
                    onChange={() => onToggleProspect(prospect.id)}
                    className="w-4 h-4 text-linkedin border-gray-300 rounded focus:ring-linkedin"
                  />
                </td>

                {/* Prospect Info */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {/* Avatar */}
                    <div className="flex-shrink-0 h-10 w-10">
                      {prospect.profile_image_url ? (
                        <img
                          className="h-10 w-10 rounded-full object-cover"
                          src={prospect.profile_image_url}
                          alt={prospect.full_name}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-linkedin flex items-center justify-center">
                          <span className="text-white font-medium">
                            {getInitials(prospect.full_name)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Name and Headline */}
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        <a
                          href={prospect.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-linkedin"
                        >
                          {prospect.full_name}
                        </a>
                      </div>
                      {prospect.headline && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {prospect.headline}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {prospect.email ? (
                    <a
                      href={`mailto:${prospect.email}`}
                      className="text-sm text-linkedin hover:underline"
                    >
                      {prospect.email}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>

                {/* Company */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{prospect.company || '-'}</div>
                  {prospect.location && (
                    <div className="text-sm text-gray-500">{prospect.location}</div>
                  )}
                </td>

                {/* Status Badge */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                      prospect.connection_status
                    )}`}
                  >
                    {CONNECTION_STATUS_LABELS[prospect.connection_status]}
                  </span>
                </td>

                {/* Tags */}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {prospect.tags && prospect.tags.length > 0 ? (
                      prospect.tags.map((tag) => (
                        <Tag
                          key={tag.id}
                          name={tag.name}
                          color={tag.color}
                          removable
                          onRemove={() => handleRemoveTag(prospect.id, tag.id)}
                        />
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">No tags</span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(prospect)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(prospect)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProspectTable;
