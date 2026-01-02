/**
 * Inbox Hooks
 *
 * React Query hooks for LinkedIn messaging inbox management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import inboxService from '../services/inbox.service';

/**
 * Hook to fetch conversations
 */
export const useConversations = (params = {}) => {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => inboxService.getConversations(params),
    staleTime: 30000, // 30 seconds
  });
};

/**
 * Hook to fetch a single conversation with messages
 */
export const useConversation = (id) => {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => inboxService.getConversation(id),
    enabled: !!id,
    staleTime: 10000, // 10 seconds
  });
};

/**
 * Hook to fetch inbox stats
 */
export const useInboxStats = () => {
  return useQuery({
    queryKey: ['inboxStats'],
    queryFn: () => inboxService.getStats(),
    staleTime: 60000, // 1 minute
  });
};

/**
 * Hook to sync conversations from extension
 */
export const useSyncConversations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversations) => inboxService.syncConversations(conversations),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      queryClient.invalidateQueries(['inboxStats']);
    },
  });
};

/**
 * Hook to sync messages for a conversation
 */
export const useSyncMessages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, messages }) =>
      inboxService.syncMessages(conversationId, messages),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['conversation', variables.conversationId]);
      queryClient.invalidateQueries(['conversations']);
    },
  });
};

/**
 * Hook to send a message
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content }) =>
      inboxService.sendMessage(conversationId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['conversation', variables.conversationId]);
      queryClient.invalidateQueries(['conversations']);
    },
  });
};

/**
 * Hook to mark conversation as read
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId) => inboxService.markAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      queryClient.invalidateQueries(['inboxStats']);
    },
  });
};

/**
 * Hook to delete a conversation
 */
export const useDeleteConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => inboxService.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations']);
      queryClient.invalidateQueries(['inboxStats']);
    },
  });
};

/**
 * Hook to get pending messages
 */
export const usePendingMessages = () => {
  return useQuery({
    queryKey: ['pendingMessages'],
    queryFn: () => inboxService.getPendingMessages(),
    staleTime: 30000,
  });
};

/**
 * Hook to get scheduled messages
 */
export const useScheduledMessages = () => {
  return useQuery({
    queryKey: ['scheduledMessages'],
    queryFn: () => inboxService.getScheduledMessages(),
    staleTime: 30000,
  });
};

/**
 * Hook to send a scheduled message
 */
export const useSendScheduledMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content, scheduledAt }) =>
      inboxService.sendScheduledMessage(conversationId, content, scheduledAt),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['conversation', variables.conversationId]);
      queryClient.invalidateQueries(['conversations']);
      queryClient.invalidateQueries(['scheduledMessages']);
    },
  });
};

/**
 * Hook to cancel a scheduled message
 */
export const useCancelScheduledMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId) => inboxService.cancelScheduledMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledMessages']);
      queryClient.invalidateQueries(['conversations']);
    },
  });
};

/**
 * Hook to update a scheduled message
 */
export const useUpdateScheduledMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, data }) =>
      inboxService.updateScheduledMessage(messageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledMessages']);
      queryClient.invalidateQueries(['conversations']);
    },
  });
};
