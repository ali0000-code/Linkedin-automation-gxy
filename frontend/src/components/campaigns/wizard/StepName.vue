<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-bold text-theme-primary mb-2">Campaign Details</h2>
      <p class="text-sm text-theme-secondary">Give your campaign a name and description</p>
    </div>

    <div>
      <label class="block text-sm font-medium text-theme-secondary mb-2">
        Campaign Name <span class="text-red-500">*</span>
      </label>
      <input
        type="text"
        :value="campaignData.name"
        @input="$emit('update', { name: $event.target.value })"
        placeholder="e.g., Outreach to Marketing Managers"
        class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-theme-secondary mb-2">Description (Optional)</label>
      <textarea
        :value="campaignData.description"
        @input="$emit('update', { description: $event.target.value })"
        placeholder="Brief description of your campaign goals..."
        :rows="3"
        class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-theme-secondary mb-2">Daily Limit</label>
      <input
        type="number"
        :value="campaignData.daily_limit"
        @input="$emit('update', { daily_limit: parseInt($event.target.value) || 50 })"
        min="1"
        max="100"
        class="w-full px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-linkedin focus:border-transparent"
      />
      <p class="text-xs text-theme-muted mt-1">Maximum number of actions per day (1-100)</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  campaignData: {
    type: Object,
    required: true
  }
})

defineEmits(['update'])
</script>
