/**
 * Template Hooks
 *
 * React Query hooks for managing message templates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateService } from '../services/template.service';

/**
 * Hook to fetch templates, optionally filtered by type
 * @param {string} type - Optional filter ('invitation' or 'message')
 */
export const useTemplates = (type = null) => {
  return useQuery({
    queryKey: ['templates', type],
    queryFn: () => templateService.getTemplates(type),
  });
};

/**
 * Hook to fetch a single template by ID
 * @param {number} id - Template ID
 */
export const useTemplate = (id) => {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => templateService.getTemplate(id),
    enabled: !!id,
  });
};

/**
 * Hook to create a new template
 */
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => templateService.createTemplate(data),
    onSuccess: (response) => {
      // Invalidate all template queries
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

/**
 * Hook to update an existing template
 */
export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => templateService.updateTemplate(id, data),
    onSuccess: (response, variables) => {
      // Invalidate all template queries and the specific template
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', variables.id] });
    },
  });
};

/**
 * Hook to delete a template
 */
export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => templateService.deleteTemplate(id),
    onSuccess: () => {
      // Invalidate all template queries
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

/**
 * Hook to bulk delete templates
 */
export const useBulkDeleteTemplates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateIds) => templateService.bulkDeleteTemplates(templateIds),
    onSuccess: () => {
      // Invalidate all template queries
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};
