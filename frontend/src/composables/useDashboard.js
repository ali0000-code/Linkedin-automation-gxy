/**
 * @file useDashboard.js - Vue Query composable for dashboard statistics
 *
 * Provides a single composable that fetches aggregated stats (prospects, campaigns,
 * today's activity, active campaigns, next scheduled action).
 *
 * Polling strategy:
 * - refetchInterval: 60s -- keeps the dashboard reasonably fresh without hammering the API
 * - refetchIntervalInBackground: false -- stops polling when the user switches to another
 *   browser tab, saving server resources and bandwidth. Polling resumes when the tab regains focus.
 * - staleTime: 30s -- within this window, navigating away and back will use cached data instantly
 */

import { useQuery } from '@tanstack/vue-query';
import dashboardService from '../services/dashboard.service';

/**
 * Fetch dashboard statistics with background polling.
 */
export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getStats(),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 30000,
  });
};
