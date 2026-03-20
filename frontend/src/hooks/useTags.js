/**
 * Tags React Query Hooks
 *
 * Custom hooks for fetching and mutating tag data using TanStack Query.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagService } from '../services/tag.service';

/**
 * Fetch all tags
 * @returns {object} Query result with data, isLoading, error, etc.
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
    staleTime: 60000, // Consider data fresh for 60 seconds
  });
};

/**
 * Fetch single tag by ID
 * @param {number} id - Tag ID
 * @returns {object} Query result
 */
export const useTag = (id) => {
  return useQuery({
    queryKey: ['tag', id],
    queryFn: () => tagService.getTag(id),
    enabled: !!id, // Only fetch if ID exists
  });
};

/**
 * Create new tag mutation
 * @returns {object} Mutation object with mutate function
 */
export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => tagService.createTag(data),
    onSuccess: (data) => {
      console.log('Create tag mutation success, returned data:', data);
      // Invalidate tags list
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
 * @returns {object} Mutation object with mutate function
 */
export const useUpdateTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => tagService.updateTag(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific tag and tags list
      queryClient.invalidateQueries({ queryKey: ['tag', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      // Also invalidate prospects since they include tags
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Delete tag mutation
 * @returns {object} Mutation object with mutate function
 */
export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => tagService.deleteTag(id),
    onSuccess: () => {
      // Invalidate tags list and prospects
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};
