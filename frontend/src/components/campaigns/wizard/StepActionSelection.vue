<template>
  <div v-if="loading" class="flex justify-center py-12">
    <Spinner size="lg" />
  </div>

  <div v-else class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Select Action Type</h2>
      <p class="text-sm text-theme-secondary">Choose what action to perform on LinkedIn</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="action in actions"
        :key="action.id"
        @click="$emit('update', { selectedAction: action.id })"
        :class="[
          'p-6 border-2 rounded-lg cursor-pointer transition-all',
          campaignData.selectedAction === action.id
            ? 'border-linkedin bg-blue-50'
            : 'border-theme hover:border-theme'
        ]"
      >
        <div class="flex items-start space-x-4">
          <div
            :class="[
              'w-12 h-12 rounded-lg flex items-center justify-center',
              campaignData.selectedAction === action.id ? 'bg-linkedin' : 'bg-theme-overlay'
            ]"
          >
            <svg
              :class="[
                'w-6 h-6',
                campaignData.selectedAction === action.id ? 'text-white' : 'text-theme-secondary'
              ]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                v-if="action.key === 'visit'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
              <path
                v-if="action.key === 'invite'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
              <path
                v-if="action.key === 'message'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
              <path
                v-if="action.key === 'follow'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
              <path
                v-if="action.key === 'email' || action.key === 'email_message'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
              <path
                v-if="action.key === 'connect_message'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
              <path
                v-if="action.key === 'visit_follow_connect'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-theme-primary mb-1">{{ action.name }}</h3>
            <p class="text-sm text-theme-secondary">{{ action.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Spinner from '../../common/Spinner.vue'

defineProps({
  actions: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  campaignData: {
    type: Object,
    required: true
  }
})

defineEmits(['update'])
</script>
