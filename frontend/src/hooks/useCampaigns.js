/**
 * Campaign React Query Hooks
 *
 * Custom hooks for fetching and mutating campaign data using TanStack Query.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import campaignService from '../services/campaign.service';
import { startCampaignQueue } from '../services/extension.service';

/**
 * Fetch paginated campaigns with filters
 * @param {object} filters - Query filters (status, search, per_page, page)
 * @returns {object} Query result with data, isLoading, error, etc.
 */
export const useCampaigns = (filters = {}) => {
  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => campaignService.getCampaigns(filters),
    keepPreviousData: true,
    staleTime: 30000,
  });
};

/**
 * Fetch single campaign by ID
 * @param {number} id - Campaign ID
 * @returns {object} Query result
 */
export const useCampaign = (id) => {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignService.getCampaign(id),
    enabled: !!id,
  });
};

/**
 * Fetch campaign statistics
 * @returns {object} Query result with stats
 */
export const useCampaignStats = () => {
  return useQuery({
    queryKey: ['campaign-stats'],
    queryFn: () => campaignService.getStats(),
  });
};

/**
 * Fetch available campaign action types
 * @returns {object} Query result with action types
 */
export const useCampaignActions = () => {
  return useQuery({
    queryKey: ['campaign-actions'],
    queryFn: () => campaignService.getCampaignActions(),
    staleTime: Infinity, // Action types don't change often
  });
};

/**
 * Create new campaign mutation
 * @returns {object} Mutation object with mutate function
 */
export const useCreateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => campaignService.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    },
  });
};

/**
 * Update campaign mutation
 * @returns {object} Mutation object with mutate function
 */
export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => campaignService.updateCampaign(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

/**
 * Delete campaign mutation
 * @returns {object} Mutation object with mutate function
 */
export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => campaignService.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    },
  });
};

/**
 * Add prospects to campaign mutation
 * @returns {object} Mutation object with mutate function
 */
export const useAddProspects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, prospectIds }) => campaignService.addProspects(id, prospectIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

/**
 * Remove prospects from campaign mutation
 * @returns {object} Mutation object with mutate function
 */
export const useRemoveProspects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, prospectIds }) => campaignService.removeProspects(id, prospectIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};

/**
 * Start campaign mutation
 * Automatically triggers the extension to start processing actions
 * @returns {object} Mutation object with mutate function
 */
export const useStartCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => campaignService.startCampaign(id),
    onSuccess: (response, id) => {
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });

      // Trigger extension to start processing (fire-and-forget, don't block)
      console.log('[useCampaigns] Campaign started, triggering extension...');
      startCampaignQueue()
        .then((result) => {
          console.log('[useCampaigns] Extension response:', result);
        })
        .catch((error) => {
          // Don't fail if extension communication fails
          console.warn('[useCampaigns] Could not auto-start extension queue:', error.message);
        });
    },
  });
};

/**
 * Pause campaign mutation
 * @returns {object} Mutation object with mutate function
 */
export const usePauseCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => campaignService.pauseCampaign(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    },
  });
};
