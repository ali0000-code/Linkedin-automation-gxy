/**
 * Auth Store (Pinia)
 *
 * Manages authentication state. Persists token + user to localStorage.
 * Extension authenticates independently via auth key — no token sharing.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // State — initialize from localStorage for persistence across reloads
  const token = ref(localStorage.getItem('auth_token') || null)
  const user = ref(JSON.parse(localStorage.getItem('auth_user') || 'null'))

  // Computed
  const isAuthenticated = computed(() => !!token.value)

  // Actions
  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('auth_token', newToken)
  }

  function setUser(newUser) {
    user.value = newUser
    localStorage.setItem('auth_user', JSON.stringify(newUser))
  }

  function setAuth(newToken, newUser) {
    setToken(newToken)
    setUser(newUser)
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  return { token, user, isAuthenticated, setToken, setUser, setAuth, clearAuth }
})
