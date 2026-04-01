/**
 * ProspectStats Component
 *
 * Display prospect statistics cards (total, by connection status).
 */

import { useProspectStats } from '../../hooks/useProspects';
import Spinner from '../common/Spinner';

const ProspectStats = () => {
  const { data: statsData, isLoading } = useProspectStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <Spinner size="sm" />
          </div>
        ))}
      </div>
    );
  }

  const stats = statsData?.stats || {};

  const statCards = [
    {
      label: 'Total Prospects',
      value: stats.total || 0,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: 'Not Connected',
      value: stats.not_connected || 0,
      color: 'text-gray-600',
      bg: 'bg-gray-50'
    },
    {
      label: 'Pending',
      value: stats.pending || 0,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50'
    },
    {
      label: 'Connected',
      value: stats.connected || 0,
      color: 'text-green-600',
      bg: 'bg-green-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${stat.bg} mb-3`}>
            <span className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
          <p className="text-sm text-gray-600">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};

export default ProspectStats;
