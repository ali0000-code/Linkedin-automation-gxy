import { unref } from 'vue';
/**
 * @file useProspects.js - Vue Query composables for prospect CRUD and tagging
 *
 * Key patterns:
 * - useProspects accepts an `options` spread param so callers can pass `{ enabled: false }`
 *   to conditionally disable the query (e.g., the Tags page only fetches when a tag is selected)
 * - placeholderData: keepPreviousData prevents table flash during pagination
 * - All mutations invalidate both the specific item and the list queries to keep the UI consistent
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query';
import { prospectService } from '../services/prospect.service';

/**
 * Fetch paginated prospects with filters.
 *
 * The `options` spread allows callers to override any Vue Query option,
 * most commonly `{ enabled: !!someCondition }` to conditionally disable the query.
 *
 * @param {object} filters - Query filters (per_page, connection_status, tag_id, search, page)
 * @param {object} options - Additional Vue Query options (e.g., { enabled })
 */
export const useProspects = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ['prospects', filters],
    queryFn: () => prospectService.getProspects(unref(filters)),
    placeholderData: keepPreviousData,
    staleTime: 30000,
    ...options,
  });
};

/**
 * Fetch single prospect by ID
 * @param {number} id - Prospect ID
 */
export const useProspect = (id) => {
  return useQuery({
    queryKey: ['prospect', id],
    queryFn: () => prospectService.getProspect(unref(id)),
    enabled: !!id,
  });
};

/**
 * Fetch prospect statistics
 */
export const useProspectStats = () => {
  return useQuery({
    queryKey: ['prospect-stats'],
    queryFn: () => prospectService.getStats(),
  });
};

/**
 * Create new prospect mutation
 */
export const useCreateProspect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => prospectService.createProspect(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Update prospect mutation
 */
export const useUpdateProspect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => prospectService.updateProspect(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Delete prospect mutation
 */
export const useDeleteProspect = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => prospectService.deleteProspect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Attach tags to prospect mutation
 */
export const useAttachTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectId, tagIds }) => prospectService.attachTags(prospectId, tagIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Detach tag from prospect mutation
 */
export const useDetachTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectId, tagId }) => prospectService.detachTag(prospectId, tagId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Bulk delete prospects mutation
 */
export const useBulkDeleteProspects = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prospectIds) => prospectService.bulkDelete(prospectIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] });
    },
  });
};

/**
 * Bulk attach tags to prospects mutation
 */
export const useBulkAttachTags = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectIds, tagIds }) => prospectService.bulkAttachTags(prospectIds, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};
