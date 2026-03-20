/**
 * Inbox Page
 *
 * LinkedIn messaging inbox with conversation list and chat view.
 */

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import {
  useConversations,
  useConversation,
  useInboxStats,
  useSendMessage,
  useMarkAsRead,
  useDeleteConversation,
  useScheduledMessages,
  useCancelScheduledMessage,
  useSendScheduledMessage,
} from '../hooks/useInbox';
import { useExtension } from '../hooks/useExtension';

// Icons
const InboxIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

const SyncIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString();
};

// Format message time
const formatMessageTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Conversation List Item
const ConversationItem = ({ conversation, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-linkedin' : ''
      } ${conversation.is_unread ? 'bg-blue-50/50' : ''}`}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {conversation.participant_avatar_url ? (
            <img
              src={conversation.participant_avatar_url}
              alt={conversation.participant_name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-linkedin flex items-center justify-center text-white font-semibold">
              {conversation.participant_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm truncate ${conversation.is_unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
              {conversation.participant_name}
            </h3>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatRelativeTime(conversation.last_message_at)}
            </span>
          </div>

          {conversation.participant_headline && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {conversation.participant_headline}
            </p>
          )}

          <p className={`text-sm truncate mt-1 ${conversation.is_unread ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
            {conversation.last_message_preview || 'No messages yet'}
          </p>
        </div>

        {/* Unread badge */}
        {conversation.unread_count > 0 && (
          <div className="flex-shrink-0 bg-linkedin text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {conversation.unread_count}
          </div>
        )}
      </div>
    </div>
  );
};

// Format scheduled time
const formatScheduledTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Message Bubble
const MessageBubble = ({ message, onCancelScheduled }) => {
  const isFromMe = message.is_from_me;
  const isScheduled = message.status === 'scheduled';

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isScheduled
            ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 border-dashed rounded-br-sm'
            : isFromMe
            ? 'bg-linkedin text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className={`flex items-center justify-end mt-1 space-x-1 ${
          isScheduled ? 'text-amber-700' : isFromMe ? 'text-white/70' : 'text-gray-400'
        }`}>
          {isScheduled ? (
            <>
              <ClockIcon />
              <span className="text-xs">Scheduled: {formatScheduledTime(message.scheduled_at)}</span>
              {onCancelScheduled && (
                <button
                  onClick={() => onCancelScheduled(message.id)}
                  className="ml-2 text-red-600 hover:text-red-800"
                  title="Cancel scheduled message"
                >
                  <XIcon />
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-xs">{formatMessageTime(message.sent_at)}</span>
              {message.status === 'pending' && (
                <span className="text-xs">(Sending...)</span>
              )}
              {message.status === 'failed' && (
                <span className="text-xs text-red-300">(Failed)</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Chat View Component
const ChatView = ({ conversation, messages, onSendMessage, onScheduleMessage, onCancelScheduled, onBack, isSending, onSyncMessages, isSyncingMessages }) => {
  const [newMessage, setNewMessage] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (newMessage.trim() && !isSending) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleSchedule = () => {
    if (!newMessage.trim() || !scheduledDate || !scheduledTime) return;

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledAt <= new Date()) {
      alert('Please select a future date and time');
      return;
    }

    onScheduleMessage(newMessage.trim(), scheduledAt.toISOString());
    setNewMessage('');
    setScheduledDate('');
    setScheduledTime('');
    setShowScheduler(false);
  };

  // Get minimum date (today) for date picker
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center space-x-3">
        <button
          onClick={onBack}
          className="md:hidden p-1 hover:bg-gray-100 rounded-full"
        >
          <BackIcon />
        </button>

        {conversation.participant_avatar_url ? (
          <img
            src={conversation.participant_avatar_url}
            alt={conversation.participant_name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-linkedin flex items-center justify-center text-white font-semibold">
            {conversation.participant_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {conversation.participant_name}
          </h3>
          {conversation.participant_headline && (
            <p className="text-xs text-gray-500 truncate">
              {conversation.participant_headline}
            </p>
          )}
        </div>

        <button
          onClick={onSyncMessages}
          disabled={isSyncingMessages}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-linkedin disabled:opacity-50"
          title="Sync messages from LinkedIn"
        >
          <SyncIcon />
        </button>

        {conversation.participant_profile_url && (
          <a
            href={conversation.participant_profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-linkedin hover:underline text-sm"
          >
            View Profile
          </a>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages?.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet.</p>
            <p className="text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages?.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onCancelScheduled={message.status === 'scheduled' ? onCancelScheduled : null}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {/* Schedule Picker */}
        {showScheduler && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-amber-800 flex items-center">
                <ClockIcon />
                <span className="ml-1">Schedule Message</span>
              </span>
              <button
                onClick={() => setShowScheduler(false)}
                className="text-amber-600 hover:text-amber-800"
              >
                <XIcon />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={getMinDate()}
                className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <Button
                type="button"
                onClick={handleSchedule}
                disabled={!newMessage.trim() || !scheduledDate || !scheduledTime || isSending}
                className="bg-amber-500 hover:bg-amber-600"
              >
                Schedule
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSend}>
          <div className="flex items-end space-x-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-linkedin focus:border-transparent resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowScheduler(!showScheduler)}
              className={`p-2 rounded-lg border ${
                showScheduler
                  ? 'bg-amber-100 border-amber-300 text-amber-600'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-100'
              }`}
              title="Schedule message"
            >
              <ClockIcon />
            </button>
            <Button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="flex-shrink-0"
            >
              {isSending ? <Spinner size="sm" /> : <SendIcon />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line. Click <ClockIcon /> to schedule.
          </p>
        </form>
      </div>
    </div>
  );
};

// Empty State
const EmptyState = ({ onSync, isSyncing }) => (
  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
    <InboxIcon />
    <h3 className="mt-4 text-lg font-medium text-gray-900">No conversations yet</h3>
    <p className="mt-2 text-center">
      Sync your LinkedIn inbox to see your conversations here.
    </p>
    <Button onClick={onSync} disabled={isSyncing} className="mt-4">
      {isSyncing ? (
        <>
          <Spinner size="sm" />
          <span className="ml-2">Syncing...</span>
        </>
      ) : (
        <>
          <SyncIcon />
          <span className="ml-2">Sync Inbox</span>
        </>
      )}
    </Button>
  </div>
);

// Main Inbox Component
const Inbox = () => {
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: conversationsData, isLoading, refetch } = useConversations({ page, per_page: 30 });
  const { data: stats } = useInboxStats();
  const { data: conversationData, isLoading: isLoadingConversation } = useConversation(selectedConversationId);
  const sendMessageMutation = useSendMessage();
  const markAsReadMutation = useMarkAsRead();
  const deleteConversationMutation = useDeleteConversation();
  const cancelScheduledMutation = useCancelScheduledMessage();
  const sendScheduledMutation = useSendScheduledMessage();
  const { triggerSync, sendLinkedInMessage, syncConversationMessages, checkLinkedInLogin, quickSyncInbox, isConnected } = useExtension();

  const conversations = conversationsData?.data || [];
  const selectedConversation = conversationData?.conversation;
  const messages = selectedConversation?.messages || [];

  // Auto-sync inbox when page loads (if extension is connected)
  useEffect(() => {
    if (!isConnected) return;

    // Trigger quick sync in background
    quickSyncInbox().then((result) => {
      if (result?.success) {
        // Refresh conversation list after sync
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['inboxStats'] });
      }
    });
  }, [isConnected, quickSyncInbox, queryClient]);

  // Poll for new messages every 5 seconds when a conversation is selected
  useEffect(() => {
    if (!selectedConversationId) return;

    const pollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [selectedConversationId, queryClient]);

  // Track which conversations we've already synced messages for (to avoid repeated syncs)
  const syncedConversationsRef = useRef(new Set());

  // Auto-sync messages when opening a conversation with no messages
  useEffect(() => {
    // Skip if no conversation selected or still loading
    if (!selectedConversation || isLoadingConversation) return;

    // Skip if not connected to extension
    if (!isConnected) return;

    // Skip if we already synced this conversation
    if (syncedConversationsRef.current.has(selectedConversation.id)) return;

    // Skip if conversation already has messages
    if (messages.length > 0) {
      // Mark as synced since it has messages
      syncedConversationsRef.current.add(selectedConversation.id);
      return;
    }

    // Auto-sync messages for this conversation
    const linkedinConvId = selectedConversation.linkedin_conversation_id;
    const backendConvId = selectedConversation.id;

    if (linkedinConvId && backendConvId) {
      console.log('[Inbox] Auto-syncing messages for conversation:', backendConvId);
      syncedConversationsRef.current.add(selectedConversation.id);

      syncConversationMessages(linkedinConvId, backendConvId)
        .then((result) => {
          console.log('[Inbox] Auto-sync result:', result);
          queryClient.invalidateQueries({ queryKey: ['conversation', backendConvId] });
        })
        .catch((error) => {
          console.error('[Inbox] Auto-sync failed:', error);
          // Remove from synced set so user can try manual sync
          syncedConversationsRef.current.delete(selectedConversation.id);
        });
    }
  }, [selectedConversation, isLoadingConversation, isConnected, messages.length, syncConversationMessages, queryClient]);

  // Handle conversation selection
  const handleSelectConversation = async (conversation) => {
    setSelectedConversationId(conversation.id);

    // Mark as read
    if (conversation.is_unread) {
      markAsReadMutation.mutate(conversation.id);
    }
  };

  // Handle sync
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Trigger extension sync
      const result = await triggerSync('SYNC_INBOX', { limit: 50, includeMessages: false });
      console.log('Sync result:', result);
      // Refetch conversations
      await refetch();
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Make sure you have LinkedIn open in a browser tab and the extension is active.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle send message
  const handleSendMessage = async (content) => {
    // IMPORTANT: Capture conversation IDs at the START to prevent race conditions
    // If user switches conversations during async operations, we still send to the original conversation
    const targetConversationId = selectedConversationId;
    const targetLinkedInConversationId = selectedConversation?.linkedin_conversation_id;

    if (!targetConversationId || !targetLinkedInConversationId) {
      console.error('Cannot send message: missing conversation ID');
      return;
    }

    console.log('Sending message to conversation:', targetConversationId, 'LinkedIn ID:', targetLinkedInConversationId);

    try {
      // 1. Create pending message in backend
      const result = await sendMessageMutation.mutateAsync({
        conversationId: targetConversationId,
        content,
      });

      // 2. Send via LinkedIn API (much more reliable than DOM approach)
      if (result?.data?.id) {
        try {
          const sendResult = await sendLinkedInMessage(
            targetLinkedInConversationId,
            content,
            result.data.id
          );
          console.log('LinkedIn API send result:', sendResult);

          // Refresh to get updated message status
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['conversation', targetConversationId] });
          }, 500);
        } catch (extError) {
          console.error('Failed to send via LinkedIn API:', extError);
          alert(extError.message || 'Failed to send message via LinkedIn.');
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await deleteConversationMutation.mutateAsync(id);
      if (selectedConversationId === id) {
        setSelectedConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  // State for syncing messages
  const [isSyncingMessages, setIsSyncingMessages] = useState(false);

  // Handle sync messages for current conversation
  const handleSyncMessages = async () => {
    // Capture IDs at the START to prevent race conditions
    const targetConversationId = selectedConversationId;
    const targetLinkedInConversationId = selectedConversation?.linkedin_conversation_id;

    if (!targetLinkedInConversationId || !targetConversationId) return;

    setIsSyncingMessages(true);
    try {
      // Sync messages via LinkedIn API
      const result = await syncConversationMessages(
        targetLinkedInConversationId,
        targetConversationId
      );
      console.log('Messages synced:', result);

      // Refresh conversation
      queryClient.invalidateQueries({ queryKey: ['conversation', targetConversationId] });
    } catch (error) {
      console.error('Failed to sync messages:', error);
      alert('Failed to sync messages. Make sure you are logged into LinkedIn.');
    } finally {
      setIsSyncingMessages(false);
    }
  };

  // Handle schedule message
  const handleScheduleMessage = async (content, scheduledAt) => {
    // Capture conversation ID at the START to prevent race conditions
    const targetConversationId = selectedConversationId;

    if (!targetConversationId) {
      console.error('Cannot schedule message: no conversation selected');
      return;
    }

    console.log('Scheduling message for conversation:', targetConversationId);

    try {
      await sendScheduledMutation.mutateAsync({
        conversationId: targetConversationId,
        content,
        scheduledAt,
      });
      queryClient.invalidateQueries({ queryKey: ['conversation', targetConversationId] });
    } catch (error) {
      console.error('Failed to schedule message:', error);
      alert('Failed to schedule message. Please try again.');
    }
  };

  // Handle cancel scheduled message
  const handleCancelScheduledMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled message?')) return;

    try {
      await cancelScheduledMutation.mutateAsync(messageId);
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
    } catch (error) {
      console.error('Failed to cancel scheduled message:', error);
      alert('Failed to cancel scheduled message. Please try again.');
    }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
            <p className="text-gray-600 mt-1">
              {stats?.total_conversations || 0} conversations
              {stats?.unread_conversations > 0 && (
                <span className="ml-2 text-linkedin font-medium">
                  ({stats.unread_conversations} unread)
                </span>
              )}
            </p>
          </div>

          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="secondary"
            className="flex items-center space-x-2"
          >
            {isSyncing ? (
              <>
                <Spinner size="sm" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <SyncIcon />
                <span>Sync Inbox</span>
              </>
            )}
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex">
          {/* Conversation List */}
          <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" />
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState onSync={handleSync} isSyncing={isSyncing} />
            ) : (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversationId === conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Chat View */}
          <div className={`flex-1 flex flex-col ${selectedConversationId ? 'flex' : 'hidden md:flex'}`}>
            {selectedConversationId ? (
              isLoadingConversation ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size="lg" />
                </div>
              ) : selectedConversation ? (
                <ChatView
                  conversation={selectedConversation}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onScheduleMessage={handleScheduleMessage}
                  onCancelScheduled={handleCancelScheduledMessage}
                  onBack={() => setSelectedConversationId(null)}
                  isSending={sendMessageMutation.isPending || sendScheduledMutation.isPending}
                  onSyncMessages={handleSyncMessages}
                  isSyncingMessages={isSyncingMessages}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Conversation not found
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <InboxIcon />
                  <p className="mt-4">Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Inbox;
