/**
 * Mail Hooks
 *
 * React Query hooks for managing sent emails.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { mailService } from '../services/mail.service';

/**
 * Hook to fetch sent emails with pagination and filtering
 * @param {object} params - Query parameters (status, search, page, per_page)
 */
export const useMails = (params = {}) => {
  return useQuery({
    queryKey: ['mails', params],
    queryFn: () => mailService.getEmails(params),
    placeholderData: keepPreviousData,
  });
};

/**
 * Hook to fetch email statistics
 */
export const useMailStats = () => {
  return useQuery({
    queryKey: ['mailStats'],
    queryFn: () => mailService.getStats(),
  });
};

/**
 * Hook to fetch a single email by ID
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
 * Hook to fetch pending email extractions
 */
export const usePendingExtractions = () => {
  return useQuery({
    queryKey: ['pendingExtractions'],
    queryFn: () => mailService.getPendingExtractions(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

/**
 * Hook to queue emails from a campaign
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
 * Hook to discard extraction results
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
 * Hook to send a single email
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
 * Hook to send multiple emails
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
 * Hook to delete a single email
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
 * Hook to delete multiple emails
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
 * Hook to update an email (subject/body)
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
 * Hook to create a custom email
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
