/**
 * @file useTemplates.js - Vue Query composables for message template CRUD
 *
 * Templates are filtered by type ('invitation', 'message', 'email') via the queryKey,
 * so switching types fetches from cache if available. All mutations invalidate the
 * entire 'templates' key family so every type's cache is refreshed.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { templateService } from '../services/template.service';

/**
 * Composable to fetch templates, optionally filtered by type
 * @param {string} type - Optional filter ('invitation' or 'message')
 */
export const useTemplates = (type = null) => {
  return useQuery({
    queryKey: ['templates', type],
    queryFn: () => templateService.getTemplates(type),
  });
};

/**
 * Composable to fetch a single template by ID
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
 * Composable to create a new template
 */
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => templateService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

/**
 * Composable to update an existing template
 */
export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => templateService.updateTemplate(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', variables.id] });
    },
  });
};

/**
 * Composable to delete a template
 */
export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => templateService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};

/**
 * Composable to bulk delete templates
 */
export const useBulkDeleteTemplates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateIds) => templateService.bulkDeleteTemplates(templateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
};
