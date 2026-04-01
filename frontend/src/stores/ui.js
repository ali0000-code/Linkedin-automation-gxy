/**
 * UI Store (Pinia)
 * Manages UI state: sidebar, modals, notifications.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const activeModal = ref(null)
  const notifications = ref([])

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function openModal(name, data = null) {
    activeModal.value = { name, data }
  }

  function closeModal() {
    activeModal.value = null
  }

  function addNotification(notification) {
    const id = Date.now()
    notifications.value.push({ id, ...notification })
    setTimeout(() => removeNotification(id), 5000)
  }

  function removeNotification(id) {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }

  return { sidebarCollapsed, activeModal, notifications, toggleSidebar, openModal, closeModal, addNotification, removeNotification }
})
