/**
 * @file useGmailSettings.js - Vue Query composables for Gmail SMTP configuration
 *
 * Manages the Gmail App Password integration settings (connect, verify, disconnect).
 * All mutations invalidate the 'gmailSettings' query so the Settings page
 * immediately reflects the updated connection status.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { gmailService } from '../services/gmail.service';

/**
 * Composable to fetch Gmail settings
 */
export const useGmailSettings = () => {
  return useQuery({
    queryKey: ['gmailSettings'],
    queryFn: () => gmailService.getSettings(),
  });
};

/**
 * Composable to save Gmail settings
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
 * Composable to verify Gmail connection
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
 * Composable to disconnect Gmail
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
