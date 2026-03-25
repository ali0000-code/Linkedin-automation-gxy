/**
 * @file useMail.js - Vue Query composables for email management
 *
 * Provides composables for the Mail page: listing emails, sending, deleting, editing,
 * and handling email extraction results from campaigns.
 *
 * Key data-fetching patterns:
 * - useMails: uses keepPreviousData so the table doesn't flash empty between page changes
 * - usePendingExtractions: polls every 30s (refetchInterval) to detect when a campaign's
 *   email extraction completes, but disables polling when the tab is not focused
 *   (refetchIntervalInBackground: false) to conserve resources
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/vue-query';
import { mailService } from '../services/mail.service';

/**
 * Composable to fetch sent emails with pagination and filtering.
 *
 * Uses keepPreviousData as placeholderData so the table retains the previous page's
 * rows while the next page is loading, preventing a jarring flash-to-empty effect
 * during pagination.
 *
 * @param {object} params - Query parameters (status, search, page, per_page)
 */
export const useMails = (params = {}) => {
  return useQuery({
    queryKey: ['mails', params],
    queryFn: () => mailService.getEmails(params),
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });
};

/**
 * Composable to fetch email statistics
 */
export const useMailStats = () => {
  return useQuery({
    queryKey: ['mailStats'],
    queryFn: () => mailService.getStats(),
  });
};

/**
 * Composable to fetch a single email by ID
 * @param {number} id - Email ID
 */
export const useMail = (id) => {
  return useQuery({
    queryKey: ['mail', id],
    queryFn: () => mailService.getEmail(id),
    enabled: !!id,
  });
};

/**
 * Composable to fetch pending email extractions (campaigns that finished extracting emails).
 *
 * Polls every 30s so the user sees the extraction results modal as soon as
 * a campaign's email extraction completes. Polling is disabled when the browser
 * tab is not focused (refetchIntervalInBackground: false) to avoid wasting
 * bandwidth and server resources for an invisible tab.
 */
export const usePendingExtractions = () => {
  return useQuery({
    queryKey: ['pendingExtractions'],
    queryFn: () => mailService.getPendingExtractions(),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
};

/**
 * Composable to queue emails from a campaign
 */
export const useQueueFromCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, templateId, sendNow }) =>
      mailService.queueFromCampaign(campaignId, templateId, sendNow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
      queryClient.invalidateQueries({ queryKey: ['mailStats'] });
      queryClient.invalidateQueries({ queryKey: ['pendingExtractions'] });
    },
  });
};

/**
 * Composable to discard extraction results
 */
export const useDiscardExtraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId) => mailService.discardExtraction(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingExtractions'] });
    },
  });
};

/**
 * Composable to send a single email
 */
export const useSendEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId) => mailService.sendEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
      queryClient.invalidateQueries({ queryKey: ['mailStats'] });
    },
  });
};

/**
 * Composable to send multiple emails
 */
export const useSendBulk = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailIds) => mailService.sendBulk(emailIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
      queryClient.invalidateQueries({ queryKey: ['mailStats'] });
    },
  });
};

/**
 * Composable to delete a single email
 */
export const useDeleteEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId) => mailService.deleteEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
      queryClient.invalidateQueries({ queryKey: ['mailStats'] });
    },
  });
};

/**
 * Composable to delete multiple emails
 */
export const useDeleteBulk = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailIds) => mailService.deleteBulk(emailIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
      queryClient.invalidateQueries({ queryKey: ['mailStats'] });
    },
  });
};

/**
 * Composable to update an email (subject/body)
 */
export const useUpdateEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ emailId, data }) => mailService.updateEmail(emailId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
    },
  });
};

/**
 * Composable to create a custom email
 */
export const useCreateEmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => mailService.createEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails'] });
      queryClient.invalidateQueries({ queryKey: ['mailStats'] });
    },
  });
};
