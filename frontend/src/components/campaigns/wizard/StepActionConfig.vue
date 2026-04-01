<template>
  <div v-if="!selectedAction" />

  <!-- Invite action -->
  <div v-else-if="selectedAction.key === 'invite'" class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Configure Connection Request</h2>
      <p class="text-sm text-theme-secondary">Choose whether to include a note with your invitation</p>
    </div>

    <div class="space-y-4">
      <!-- Send without note -->
      <div
        @click="$emit('update', { inviteWithNote: false, selectedTemplateId: null })"
        :class="[
          'p-4 border-2 rounded-lg cursor-pointer',
          !campaignData.inviteWithNote ? 'border-linkedin bg-blue-50' : 'border-theme'
        ]"
      >
        <div class="flex items-center">
          <input
            type="radio"
            :checked="!campaignData.inviteWithNote"
            class="w-4 h-4 text-linkedin focus:ring-linkedin"
          />
          <div class="ml-3">
            <div class="text-sm font-medium text-theme-primary">Send without note</div>
            <div class="text-xs text-theme-muted">Send connection request without a message</div>
          </div>
        </div>
      </div>

      <!-- Send with note -->
      <div
        @click="$emit('update', { inviteWithNote: true })"
        :class="[
          'p-4 border-2 rounded-lg cursor-pointer',
          campaignData.inviteWithNote ? 'border-linkedin bg-blue-50' : 'border-theme'
        ]"
      >
        <div class="flex items-center">
          <input
            type="radio"
            :checked="campaignData.inviteWithNote"
            class="w-4 h-4 text-linkedin focus:ring-linkedin"
          />
          <div class="ml-3">
            <div class="text-sm font-medium text-theme-primary">Send with personalized note</div>
            <div class="text-xs text-theme-muted">Include a message (max 300 characters)</div>
          </div>
        </div>
      </div>

      <!-- Template selection -->
      <div v-if="campaignData.inviteWithNote" class="ml-7 mt-4">
        <label class="block text-sm font-medium text-theme-secondary mb-2">
          Select Invitation Template
        </label>
        <div v-if="invitationTemplates.length === 0" class="text-sm text-theme-muted p-4 bg-theme-overlay rounded-lg">
          No invitation templates found. Please create one first in Message Templates.
        </div>
        <template v-else>
          <select
            :value="campaignData.selectedTemplateId || ''"
            @change="$emit('update', { selectedTemplateId: parseInt($event.target.value) })"
            class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
          >
            <option value="">Select a template...</option>
            <option v-for="template in invitationTemplates" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>

          <div v-if="campaignData.selectedTemplateId" class="mt-3 p-3 bg-theme-overlay rounded-lg">
            <div class="text-xs text-theme-muted mb-1">Preview:</div>
            <div class="text-sm text-theme-secondary">
              {{ invitationTemplates.find(t => t.id === campaignData.selectedTemplateId)?.content }}
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- Message action -->
  <div v-else-if="selectedAction.key === 'message'" class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Configure Message</h2>
      <p class="text-sm text-theme-secondary">Select a message template to send</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Select Message Template
      </label>
      <div v-if="messageTemplates.length === 0" class="text-sm text-theme-muted p-4 bg-theme-overlay rounded-lg">
        No message templates found. Please create one first in Message Templates.
      </div>
      <template v-else>
        <select
          :value="campaignData.selectedTemplateId || ''"
          @change="$emit('update', { selectedTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select a template...</option>
          <option v-for="template in messageTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.selectedTemplateId" class="mt-3 p-3 bg-theme-overlay rounded-lg">
          <div class="text-xs text-theme-muted mb-1">Preview:</div>
          <div class="text-sm text-theme-secondary whitespace-pre-wrap">
            {{ messageTemplates.find(t => t.id === campaignData.selectedTemplateId)?.content }}
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Email action -->
  <div v-else-if="selectedAction.key === 'email'" class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Configure Email</h2>
      <p class="text-sm text-theme-secondary">
        Select an email template to use when sending emails to prospects.
        The extension will visit each prospect's profile and extract their email from Contact Info.
      </p>
    </div>

    <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="text-sm text-blue-700">
          <strong>How it works:</strong> The extension will automatically visit each prospect's LinkedIn profile,
          open their Contact Info, and extract their email address. After extraction completes, you'll see
          which prospects have emails and can send emails to them.
        </div>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Select Email Template <span class="text-red-500">*</span>
      </label>
      <div v-if="emailTemplates.length === 0" class="text-sm text-theme-muted p-4 bg-theme-overlay rounded-lg">
        No email templates found. Please create one first in Message Templates (select "Email" type).
      </div>
      <template v-else>
        <select
          :value="campaignData.selectedTemplateId || ''"
          @change="$emit('update', { selectedTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select an email template...</option>
          <option v-for="template in emailTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.selectedTemplateId" class="mt-3 p-3 bg-theme-overlay rounded-lg">
          <div class="text-xs text-theme-muted mb-1">Email Preview:</div>
          <div class="text-sm text-theme-secondary">
            <div class="font-medium mb-1">
              Subject: {{ emailTemplates.find(t => t.id === campaignData.selectedTemplateId)?.subject || 'No subject' }}
            </div>
            <div class="whitespace-pre-wrap">
              {{ emailTemplates.find(t => t.id === campaignData.selectedTemplateId)?.content }}
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Smart Connect action (connect_message) -->
  <div v-else-if="selectedAction.key === 'connect_message'" class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Configure Connect + Message</h2>
      <p class="text-sm text-theme-secondary">
        Automatically adapts based on connection status:
      </p>
    </div>

    <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div class="text-sm text-blue-700">
          <strong>How it works:</strong>
          <ul class="mt-1 list-disc list-inside space-y-1">
            <li>If already connected → Sends a direct message</li>
            <li>If not connected → Sends a connection request with note</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Message Template (for connected users) -->
    <div class="p-4 border border-theme rounded-lg">
      <div class="flex items-center mb-3">
        <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
          <svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <div class="text-sm font-medium text-theme-primary">If Connected</div>
          <div class="text-xs text-theme-muted">Message to send to existing connections</div>
        </div>
      </div>

      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Message Template <span class="text-red-500">*</span>
      </label>
      <div v-if="messageTemplates.length === 0" class="text-sm text-theme-muted p-3 bg-theme-overlay rounded-lg">
        No message templates found. Please create one first.
      </div>
      <template v-else>
        <select
          :value="campaignData.selectedTemplateId || ''"
          @change="$emit('update', { selectedTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select message template...</option>
          <option v-for="template in messageTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.selectedTemplateId" class="mt-2 p-2 bg-theme-overlay rounded text-sm text-theme-secondary">
          {{ messageTemplates.find(t => t.id === campaignData.selectedTemplateId)?.content }}
        </div>
      </template>
    </div>

    <!-- Invite Template (for not connected users) -->
    <div class="p-4 border border-theme rounded-lg">
      <div class="flex items-center mb-3">
        <div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
          <svg class="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div>
          <div class="text-sm font-medium text-theme-primary">If Not Connected</div>
          <div class="text-xs text-theme-muted">Connection request note (max 300 chars)</div>
        </div>
      </div>

      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Invitation Template <span class="text-red-500">*</span>
      </label>
      <div v-if="invitationTemplates.length === 0" class="text-sm text-theme-muted p-3 bg-theme-overlay rounded-lg">
        No invitation templates found. Please create one first.
      </div>
      <template v-else>
        <select
          :value="campaignData.inviteTemplateId || ''"
          @change="$emit('update', { inviteTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select invitation template...</option>
          <option v-for="template in invitationTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.inviteTemplateId" class="mt-2 p-2 bg-theme-overlay rounded text-sm text-theme-secondary">
          {{ invitationTemplates.find(t => t.id === campaignData.inviteTemplateId)?.content }}
        </div>
      </template>
    </div>
  </div>

  <!-- Warm Connect action (visit_follow_connect) -->
  <div v-else-if="selectedAction.key === 'visit_follow_connect'" class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Configure Visit + Follow + Connect</h2>
      <p class="text-sm text-theme-secondary">
        Warms up prospects before sending a connection request
      </p>
    </div>

    <div class="p-4 bg-amber-50 rounded-lg border border-amber-200">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <div class="text-sm text-amber-700">
          <strong>How it works:</strong>
          <ol class="mt-1 list-decimal list-inside space-y-1">
            <li>Visit the prospect's LinkedIn profile</li>
            <li>Follow their profile</li>
            <li>Send a connection request with your note</li>
          </ol>
          <p class="mt-2 text-xs">This sequence increases acceptance rates by building familiarity first.</p>
        </div>
      </div>
    </div>

    <div class="p-4 border border-theme rounded-lg">
      <div class="flex items-center mb-3">
        <div class="w-8 h-8 rounded-full bg-linkedin flex items-center justify-center mr-3">
          <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div>
          <div class="text-sm font-medium text-theme-primary">Connection Request Note</div>
          <div class="text-xs text-theme-muted">Message sent with connection request (max 300 chars)</div>
        </div>
      </div>

      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Invitation Template <span class="text-red-500">*</span>
      </label>
      <div v-if="invitationTemplates.length === 0" class="text-sm text-theme-muted p-3 bg-theme-overlay rounded-lg">
        No invitation templates found. Please create one first.
      </div>
      <template v-else>
        <select
          :value="campaignData.selectedTemplateId || ''"
          @change="$emit('update', { selectedTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select invitation template...</option>
          <option v-for="template in invitationTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.selectedTemplateId" class="mt-2 p-2 bg-theme-overlay rounded text-sm text-theme-secondary">
          {{ invitationTemplates.find(t => t.id === campaignData.selectedTemplateId)?.content }}
        </div>
      </template>
    </div>
  </div>

  <!-- Smart Email action (email_message) -->
  <div v-else-if="selectedAction.key === 'email_message'" class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Configure Email + Message</h2>
      <p class="text-sm text-theme-secondary">
        Sends email if available, with LinkedIn message as fallback
      </p>
    </div>

    <div class="p-4 bg-purple-50 rounded-lg border border-purple-200">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-purple-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <div class="text-sm text-purple-700">
          <strong>How it works:</strong>
          <ol class="mt-1 list-decimal list-inside space-y-1">
            <li>If prospect has email → Send email</li>
            <li>If no email → Visit profile and extract email from Contact Info</li>
            <li>If extraction successful → Send email</li>
            <li>If no email found → Send LinkedIn message as fallback</li>
          </ol>
        </div>
      </div>
    </div>

    <!-- Email Template (primary) -->
    <div class="p-4 border border-theme rounded-lg">
      <div class="flex items-center mb-3">
        <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
          <svg class="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <div class="text-sm font-medium text-theme-primary">Primary: Email</div>
          <div class="text-xs text-theme-muted">Sent when prospect has an email address</div>
        </div>
      </div>

      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Email Template <span class="text-red-500">*</span>
      </label>
      <div v-if="emailTemplates.length === 0" class="text-sm text-theme-muted p-3 bg-theme-overlay rounded-lg">
        No email templates found. Please create one first.
      </div>
      <template v-else>
        <select
          :value="campaignData.selectedTemplateId || ''"
          @change="$emit('update', { selectedTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select email template...</option>
          <option v-for="template in emailTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.selectedTemplateId" class="mt-2 p-2 bg-theme-overlay rounded">
          <div class="text-xs text-theme-muted mb-1">Subject:</div>
          <div class="text-sm text-theme-secondary font-medium mb-2">
            {{ emailTemplates.find(t => t.id === campaignData.selectedTemplateId)?.subject || 'No subject' }}
          </div>
          <div class="text-xs text-theme-muted mb-1">Body:</div>
          <div class="text-sm text-theme-secondary whitespace-pre-wrap">
            {{ emailTemplates.find(t => t.id === campaignData.selectedTemplateId)?.content }}
          </div>
        </div>
      </template>
    </div>

    <!-- Fallback Message Template -->
    <div class="p-4 border border-theme rounded-lg">
      <div class="flex items-center mb-3">
        <div class="w-8 h-8 rounded-full bg-theme-overlay flex items-center justify-center mr-3">
          <svg class="w-4 h-4 text-theme-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <div class="text-sm font-medium text-theme-primary">Fallback: LinkedIn Message</div>
          <div class="text-xs text-theme-muted">Sent when no email can be found</div>
        </div>
      </div>

      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Message Template <span class="text-red-500">*</span>
      </label>
      <div v-if="messageTemplates.length === 0" class="text-sm text-theme-muted p-3 bg-theme-overlay rounded-lg">
        No message templates found. Please create one first.
      </div>
      <template v-else>
        <select
          :value="campaignData.fallbackTemplateId || ''"
          @change="$emit('update', { fallbackTemplateId: parseInt($event.target.value) })"
          class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
        >
          <option value="">Select message template...</option>
          <option v-for="template in messageTemplates" :key="template.id" :value="template.id">
            {{ template.name }}
          </option>
        </select>

        <div v-if="campaignData.fallbackTemplateId" class="mt-2 p-2 bg-theme-overlay rounded text-sm text-theme-secondary">
          {{ messageTemplates.find(t => t.id === campaignData.fallbackTemplateId)?.content }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  actions: {
    type: Array,
    required: true
  },
  invitationTemplates: {
    type: Array,
    required: true
  },
  messageTemplates: {
    type: Array,
    required: true
  },
  emailTemplates: {
    type: Array,
    required: true
  },
  campaignData: {
    type: Object,
    required: true
  }
})

defineEmits(['update'])

const selectedAction = computed(() =>
  props.actions.find(a => a.id === props.campaignData.selectedAction)
)
</script>
