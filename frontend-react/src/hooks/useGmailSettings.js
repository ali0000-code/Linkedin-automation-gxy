/**
 * @file useGmailSettings.js - React Query hooks for Gmail SMTP configuration
 *
 * Manages the Gmail App Password integration settings (connect, verify, disconnect).
 * All mutations invalidate the 'gmailSettings' query so the Settings page
 * immediately reflects the updated connection status.
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
