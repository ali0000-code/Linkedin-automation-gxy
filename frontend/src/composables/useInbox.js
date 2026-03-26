import { unref } from 'vue';
/**
 * @file useInbox.js - Vue Query composables for LinkedIn messaging inbox
 *
 * Provides composables for:
 * - Fetching conversations and individual conversation messages
 * - Sending messages with optimistic UI updates (instant display before server confirms)
 * - Marking conversations as read / deleting with optimistic cache manipulation
 * - Scheduling, cancelling, and updating scheduled messages
 *
 * Optimistic update pattern used in useSendMessage, useMarkAsRead, useDeleteConversation:
 * 1. onMutate: cancel in-flight queries, snapshot current cache, optimistically update cache
 * 2. onError: roll back to the snapshot if the API call fails
 * 3. onSettled: invalidate queries to re-sync with server truth regardless of success/failure
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import inboxService from '../services/inbox.service';

/**
 * Composable to fetch conversations
 */
export const useConversations = (params = {}) => {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => inboxService.getConversations(unref(params)),
    staleTime: 30000,
  });
};

/**
 * Composable to fetch a single conversation with messages
 */
export const useConversation = (id) => {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => inboxService.getConversation(unref(id)),
    enabled: !!id,
    staleTime: 10000,
  });
};

/**
 * Composable to fetch inbox stats
 */
export const useInboxStats = () => {
  return useQuery({
    queryKey: ['inboxStats'],
    queryFn: () => inboxService.getStats(),
    staleTime: 60000,
  });
};

/**
 * Composable to sync conversations from extension
 */
export const useSyncConversations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversations) => inboxService.syncConversations(conversations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inboxStats'] });
    },
  });
};

/**
 * Composable to sync messages for a conversation
 */
export const useSyncMessages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, messages }) =>
      inboxService.syncMessages(conversationId, messages),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

/**
 * Composable to send a message with optimistic UI update.
 *
 * onMutate: immediately appends a temporary message (with temp ID and 'pending' status)
 * to the conversation cache so the user sees their message in the chat instantly.
 * onError: rolls back to the previous cache snapshot if the API call fails.
 * onSettled: invalidates both the conversation and the conversations list to get
 * the real message ID, status, and updated last_message preview from the server.
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content }) =>
      inboxService.sendMessage(conversationId, content),
    onMutate: async ({ conversationId, content }) => {
      // Cancel any in-flight fetches to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      // Snapshot the current cache for rollback on error
      const previous = queryClient.getQueryData(['conversation', conversationId]);

      // Optimistically append the new message with a temporary ID
      queryClient.setQueryData(['conversation', conversationId], (old) => {
        if (!old?.conversation) return old;
        return {
          ...old,
          conversation: {
            ...old.conversation,
            messages: [
              ...(old.conversation.messages || []),
              {
                id: `temp-${Date.now()}`,
                content,
                is_from_me: true,
                status: 'pending',
                sent_at: new Date().toISOString(),
              },
            ],
          },
        };
      });

      return { previous };
    },
    onError: (_, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversation', variables.conversationId], context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

/**
 * Composable to mark conversation as read with optimistic update.
 *
 * Immediately sets is_unread=false and unread_count=0 in the cached conversation list
 * so the unread badge disappears before the server responds.
 */
export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId) => inboxService.markAsRead(conversationId),
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previous = queryClient.getQueryData(['conversations', { page: 1, per_page: 30 }]);

      // Optimistically mark as read across all cached conversation list variants
      queryClient.setQueriesData({ queryKey: ['conversations'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((c) =>
            c.id === conversationId ? { ...c, is_unread: false, unread_count: 0 } : c
          ),
        };
      });

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversations', { page: 1, per_page: 30 }], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inboxStats'] });
    },
  });
};

/**
 * Composable to delete a conversation with optimistic removal.
 *
 * Immediately filters the conversation out of the cached list so the UI
 * updates instantly. On error, restores the previous list.
 */
export const useDeleteConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => inboxService.deleteConversation(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previous = queryClient.getQueryData(['conversations', { page: 1, per_page: 30 }]);

      // Optimistically remove conversation from all cached list variants
      queryClient.setQueriesData({ queryKey: ['conversations'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((c) => c.id !== id),
        };
      });

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['conversations', { page: 1, per_page: 30 }], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inboxStats'] });
    },
  });
};

/**
 * Composable to get pending messages
 */
export const usePendingMessages = () => {
  return useQuery({
    queryKey: ['pendingMessages'],
    queryFn: () => inboxService.getPendingMessages(),
    staleTime: 30000,
  });
};

/**
 * Composable to get scheduled messages
 */
export const useScheduledMessages = () => {
  return useQuery({
    queryKey: ['scheduledMessages'],
    queryFn: () => inboxService.getScheduledMessages(),
    staleTime: 30000,
  });
};

/**
 * Composable to send a scheduled message
 */
export const useSendScheduledMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content, scheduledAt }) =>
      inboxService.sendScheduledMessage(conversationId, content, scheduledAt),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
    },
  });
};

/**
 * Composable to cancel a scheduled message
 */
export const useCancelScheduledMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId) => inboxService.cancelScheduledMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

/**
 * Composable to update a scheduled message
 */
export const useUpdateScheduledMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, data }) =>
      inboxService.updateScheduledMessage(messageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};
