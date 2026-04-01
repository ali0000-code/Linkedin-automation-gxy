/**
 * Gmail Settings Hooks
 *
 * React Query hooks for managing Gmail settings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gmailService } from '../services/gmail.service';

/**
 * Hook to fetch Gmail settings
 */
export const useGmailSettings = () => {
  return useQuery({
    queryKey: ['gmailSettings'],
    queryFn: () => gmailService.getSettings(),
  });
};

/**
 * Hook to save Gmail settings
 */
export const useSaveGmailSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => gmailService.saveSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailSettings'] });
    },
  });
};

/**
 * Hook to verify Gmail connection
 */
export const useVerifyGmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => gmailService.verifyConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailSettings'] });
    },
  });
};

/**
 * Hook to disconnect Gmail
 */
export const useDisconnectGmail = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => gmailService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailSettings'] });
    },
  });
};
