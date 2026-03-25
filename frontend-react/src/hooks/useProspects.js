/**
 * @file useProspects.js - React Query hooks for prospect CRUD and tagging
 *
 * Key patterns:
 * - useProspects accepts an `options` spread param so callers can pass `{ enabled: false }`
 *   to conditionally disable the query (e.g., the Tags page only fetches when a tag is selected)
 * - placeholderData: keepPreviousData prevents table flash during pagination
 * - All mutations invalidate both the specific item and the list queries to keep the UI consistent
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { prospectService } from '../services/prospect.service';

/**
 * Fetch paginated prospects with filters.
 *
 * The `options` spread allows callers to override any React Query option,
 * most commonly `{ enabled: !!someCondition }` to conditionally disable the query.
 * For example, the Tags page passes `{ enabled: !!viewingTag }` so it only
 * fetches prospects when a tag is actually selected.
 *
 * @param {object} filters - Query filters (per_page, connection_status, tag_id, search, page)
 * @param {object} options - Additional React Query options (e.g., { enabled })
 * @returns {object} Query result with data, isLoading, error, etc.
 */
export const useProspects = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['prospects', filters],
    queryFn: () => prospectService.getProspects(filters),
    placeholderData: keepPreviousData,
    staleTime: 30000,
    ...options,
  });
};

/**
 * Fetch single prospect by ID
 * @param {number} id - Prospect ID
 * @returns {object} Query result
 */
export const useProspect = (id) => {
  return useQuery({
    queryKey: ['prospect', id],
    queryFn: () => prospectService.getProspect(id),
    enabled: !!id, // Only fetch if ID exists
  });
};

/**
 * Fetch prospect statistics
 * @returns {object} Query result with stats
 */
export const useProspectStats = () => {
  return useQuery({
    queryKey: ['prospect-stats'],
    queryFn: () => prospectService.getStats(),
  });
};

/**
 * Create new prospect mutation
 * @returns {object} Mutation object with mutate function
 */
export const useCreateProspect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => prospectService.createProspect(data),
    onSuccess: () => {
      // Invalidate and refetch prospects list and stats
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Update prospect mutation
 * @returns {object} Mutation object with mutate function
 */
export const useUpdateProspect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => prospectService.updateProspect(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific prospect and prospects list
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Delete prospect mutation
 * @returns {object} Mutation object with mutate function
 */
export const useDeleteProspect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => prospectService.deleteProspect(id),
    onSuccess: () => {
      // Invalidate prospects list and stats
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Attach tags to prospect mutation
 * @returns {object} Mutation object with mutate function
 */
export const useAttachTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectId, tagIds }) => prospectService.attachTags(prospectId, tagIds),
    onSuccess: (_, variables) => {
      // Invalidate specific prospect and prospects list
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Detach tag from prospect mutation
 * @returns {object} Mutation object with mutate function
 */
export const useDetachTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectId, tagId }) => prospectService.detachTag(prospectId, tagId),
    onSuccess: (_, variables) => {
      // Invalidate specific prospect and prospects list
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Bulk delete prospects mutation
 * @returns {object} Mutation object with mutate function
 */
export const useBulkDeleteProspects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prospectIds) => prospectService.bulkDelete(prospectIds),
    onSuccess: () => {
      // Invalidate prospects list and stats
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Bulk attach tags to prospects mutation
 * @returns {object} Mutation object with mutate function
 */
export const useBulkAttachTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectIds, tagIds }) => prospectService.bulkAttachTags(prospectIds, tagIds),
    onSuccess: () => {
      // Invalidate prospects list
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};
