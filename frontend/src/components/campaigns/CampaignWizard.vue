<template>
  <div class="max-w-4xl mx-auto">
    <!-- Progress Steps -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div v-for="(step, index) in steps" :key="step.number" class="flex items-center">
          <div class="flex flex-col items-center">
            <div
              :class="[
                'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
                currentStep >= step.number
                  ? 'bg-linkedin text-white'
                  : 'bg-gray-200 text-theme-secondary'
              ]"
            >
              {{ step.number }}
            </div>
            <div class="mt-2 text-sm font-medium text-theme-secondary">{{ step.name }}</div>
          </div>
          <div
            v-if="index < steps.length - 1"
            :class="[
              'flex-1 h-1 mx-4',
              currentStep > step.number ? 'bg-linkedin' : 'bg-gray-200'
            ]"
            :style="{ width: '100px' }"
          />
        </div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="bg-theme-raised rounded-lg shadow p-8 mb-6">
      <!-- Step 1: Campaign Name -->
      <StepName
        v-if="currentStep === 1"
        :campaignData="campaignData"
        @update="updateCampaignData"
      />

      <!-- Step 2: Action Selection -->
      <StepActionSelection
        v-if="currentStep === 2"
        :actions="actions"
        :loading="loadingActions"
        :campaignData="campaignData"
        @update="updateCampaignData"
      />

      <!-- Step 3: Action Config -->
      <StepActionConfig
        v-if="currentStep === 3"
        :actions="actions"
        :invitationTemplates="invitationTemplates"
        :messageTemplates="messageTemplates"
        :emailTemplates="emailTemplates"
        :campaignData="campaignData"
        @update="updateCampaignData"
      />

      <!-- Step 4: Tag Selection -->
      <StepTagSelection
        v-if="currentStep === 4"
        :tags="tagsWithProspects"
        :campaignData="campaignData"
        @update="updateCampaignData"
      />
    </div>

    <!-- Navigation Buttons -->
    <div class="flex justify-between">
      <div>
        <Button v-if="currentStep > 1" variant="secondary" @click="handleBack">
          Back
        </Button>
      </div>
      <div class="flex space-x-3">
        <Button variant="secondary" @click="router.push('/campaigns')">
          Cancel
        </Button>
        <template v-if="currentStep < 4">
          <Button variant="primary" @click="handleNext" :disabled="!isStepValid">
            Next
          </Button>
        </template>
        <template v-else>
          <Button
            variant="secondary"
            @click="handleSave(false)"
            :disabled="!isStepValid || isSaving"
          >
            <Spinner v-if="isSaving" size="sm" />
            <span v-else>Save as Draft</span>
          </Button>
          <Button
            variant="primary"
            @click="handleSave(true)"
            :disabled="!isStepValid || isSaving"
          >
            <Spinner v-if="isSaving" size="sm" />
            <span v-else>Save &amp; Start</span>
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from '../common/Button.vue'
import Spinner from '../common/Spinner.vue'
import StepName from './wizard/StepName.vue'
import StepActionSelection from './wizard/StepActionSelection.vue'
import StepActionConfig from './wizard/StepActionConfig.vue'
import StepTagSelection from './wizard/StepTagSelection.vue'
import { useCampaignActions, useCreateCampaign, useAddProspects, useStartCampaign } from '../../composables/useCampaigns'
import { useTemplates } from '../../composables/useTemplates'
import { useTags } from '../../composables/useTags'
import { prospectService } from '../../services/prospect.service'

const router = useRouter()
const currentStep = ref(1)
const campaignData = ref({
  name: '',
  description: '',
  daily_limit: 50,
  selectedAction: null,
  inviteWithNote: false,
  selectedTemplateId: null,
  inviteTemplateId: null,
  fallbackTemplateId: null,
  selectedTags: [],
})

// Fetch available action types
const { data: actionsData, isLoading: loadingActions } = useCampaignActions()
const actions = computed(() => actionsData.value?.actions || [])

// Fetch templates by type
const { data: invitationTemplatesData } = useTemplates('invitation')
const invitationTemplates = computed(() => invitationTemplatesData.value?.templates || [])

const { data: messageTemplatesData } = useTemplates('message')
const messageTemplates = computed(() => messageTemplatesData.value?.templates || [])

const { data: emailTemplatesData } = useTemplates('email')
const emailTemplates = computed(() => emailTemplatesData.value?.templates || [])

// Fetch tags
const { data: tagsData } = useTags()
const allTags = computed(() => (Array.isArray(tagsData.value) ? tagsData.value : []))
const tagsWithProspects = computed(() => allTags.value.filter(tag => tag.prospects_count > 0))

// Mutations
const { mutateAsync: createCampaign, isPending: isCreating } = useCreateCampaign()
const { mutateAsync: addProspects, isPending: isAddingProspects } = useAddProspects()
const { mutateAsync: startCampaign, isPending: isStarting } = useStartCampaign()

const isSaving = computed(() => isCreating.value || isAddingProspects.value || isStarting.value)

// Ref to prevent double-clicks
const isSavingRef = ref(false)

const steps = [
  { number: 1, name: 'Campaign Name' },
  { number: 2, name: 'Select Action' },
  { number: 3, name: 'Configure Action' },
  { number: 4, name: 'Select Tags' },
]

const updateCampaignData = (newData) => {
  campaignData.value = { ...campaignData.value, ...newData }
}

const handleNext = () => {
  // Skip step 3 if action doesn't need configuration
  if (currentStep.value === 2 && campaignData.value.selectedAction) {
    const action = actions.value.find(a => a.id === campaignData.value.selectedAction)
    if (action?.key === 'visit' || action?.key === 'follow') {
      currentStep.value = 4
      return
    }
  }
  currentStep.value++
}

const handleBack = () => {
  // Skip step 3 when going back if action doesn't need configuration
  if (currentStep.value === 4 && campaignData.value.selectedAction) {
    const action = actions.value.find(a => a.id === campaignData.value.selectedAction)
    if (action?.key === 'visit' || action?.key === 'follow') {
      currentStep.value = 2
      return
    }
  }
  currentStep.value--
}

const handleSave = async (shouldStart = false) => {
  if (isSavingRef.value) {
    console.log('[CampaignWizard] Already saving, ignoring click')
    return
  }
  isSavingRef.value = true

  const selectedAction = actions.value.find(a => a.id === campaignData.value.selectedAction)
  const isEmailAction = selectedAction?.key === 'email'

  const payload = {
    name: campaignData.value.name,
    description: campaignData.value.description || null,
    daily_limit: campaignData.value.daily_limit,
    tag_id: isEmailAction && campaignData.value.selectedTags.length > 0
      ? campaignData.value.selectedTags[0]
      : null,
    steps: [
      {
        campaign_action_id: campaignData.value.selectedAction,
        order: 1,
        delay_days: 0,
        message_template_id: campaignData.value.selectedTemplateId || null,
        config: selectedAction?.key === 'invite' && !campaignData.value.inviteWithNote
          ? { send_without_note: true }
          : selectedAction?.key === 'connect_message'
          ? { invite_template_id: campaignData.value.inviteTemplateId }
          : selectedAction?.key === 'email_message'
          ? { fallback_template_id: campaignData.value.fallbackTemplateId }
          : null,
      },
    ],
  }

  console.log('[CampaignWizard] Creating campaign, shouldStart:', shouldStart)

  try {
    const response = await createCampaign(payload)
    const campaignId = response.campaign.id
    console.log('[CampaignWizard] Campaign created:', campaignId)

    if (isEmailAction) {
      if (shouldStart) {
        console.log('[CampaignWizard] Starting email campaign...')
        await startCampaign(campaignId)
        console.log('[CampaignWizard] Email campaign started')
      }
      isSavingRef.value = false
      router.push('/campaigns')
      return
    }

    // Fetch and add prospects for non-email campaigns
    try {
      console.log('[CampaignWizard] Fetching prospects for tags:', campaignData.value.selectedTags)
      const prospectsResponse = await prospectService.getProspects({
        tag_ids: campaignData.value.selectedTags.join(','),
        per_page: 1000
      })

      const prospectIds = (prospectsResponse.data || []).map(p => p.id)
      console.log('[CampaignWizard] Found prospects:', prospectIds.length)

      if (prospectIds.length > 0) {
        const addPromise = addProspects({ id: campaignId, prospectIds })
        const addTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Add prospects timeout after 15s')), 15000)
        )
        await Promise.race([addPromise, addTimeoutPromise])
        console.log('[CampaignWizard] Prospects added')
      }
    } catch (prospectError) {
      console.error('[CampaignWizard] Error with prospects:', prospectError)
    }

    if (shouldStart) {
      console.log('[CampaignWizard] Starting campaign...', campaignId)
      try {
        const startPromise = startCampaign(campaignId)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Start campaign timeout after 15s')), 15000)
        )
        await Promise.race([startPromise, timeoutPromise])
        console.log('[CampaignWizard] Campaign started successfully')
      } catch (startError) {
        console.error('[CampaignWizard] Start campaign error:', startError)
      }
    }

    isSavingRef.value = false
    router.push('/campaigns')
  } catch (error) {
    console.error('[CampaignWizard] Error:', error)
    isSavingRef.value = false
    router.push('/campaigns')
  }
}

const isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      return campaignData.value.name.trim() !== ''
    case 2:
      return campaignData.value.selectedAction !== null
    case 3: {
      const action = actions.value.find(a => a.id === campaignData.value.selectedAction)
      if (action?.key === 'invite') {
        return campaignData.value.inviteWithNote ? campaignData.value.selectedTemplateId !== null : true
      }
      if (action?.key === 'message') {
        return campaignData.value.selectedTemplateId !== null
      }
      if (action?.key === 'email') {
        return campaignData.value.selectedTemplateId !== null
      }
      if (action?.key === 'connect_message') {
        return campaignData.value.selectedTemplateId !== null && campaignData.value.inviteTemplateId !== null
      }
      if (action?.key === 'visit_follow_connect') {
        return campaignData.value.inviteWithNote ? campaignData.value.selectedTemplateId !== null : true
      }
      if (action?.key === 'email_message') {
        return campaignData.value.selectedTemplateId !== null && campaignData.value.fallbackTemplateId !== null
      }
      return true
    }
    case 4:
      return campaignData.value.selectedTags.length > 0
    default:
      return false
  }
})
</script>
