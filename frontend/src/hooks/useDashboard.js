/**
 * Dashboard React Query Hooks
 *
 * Custom hooks for fetching dashboard statistics using TanStack Query.
 */

import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboard.service';

/**
 * Fetch dashboard statistics
 * @returns {object} Query result with data, isLoading, error, etc.
 */
export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
};
