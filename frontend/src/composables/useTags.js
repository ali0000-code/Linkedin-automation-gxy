import { unref } from 'vue';
/**
 * @file useTags.js - Vue Query composables for tag CRUD
 *
 * Tags are lightweight entities (typically <50 total) so they use a longer staleTime (60s)
 * and no pagination. Mutations invalidate both the 'tags' and 'prospects' query keys
 * because prospect rows display their associated tags inline.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { tagService } from '../services/tag.service';

/**
 * Fetch all tags
 */
export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      console.log('Fetching tags...');
      const data = await tagService.getTags();
      console.log('Tags fetched:', data);
      return data;
    },
    staleTime: 60000,
  });
};

/**
 * Fetch single tag by ID
 * @param {number} id - Tag ID
 */
export const useTag = (id) => {
  return useQuery({
    queryKey: ['tag', id],
    queryFn: () => tagService.getTag(unref(id)),
    enabled: !!id,
  });
};

/**
 * Create new tag mutation
 */
export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => tagService.createTag(data),
    onSuccess: (data) => {
      console.log('Create tag mutation success, returned data:', data);
      console.log('Invalidating tags query...');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      console.log('Tags query invalidated');
    },
    onError: (error) => {
      console.error('Create tag mutation error:', error);
    },
  });
};

/**
 * Update tag mutation
 */
export const useUpdateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => tagService.updateTag(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tag', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Delete tag mutation
 */
export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => tagService.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};
