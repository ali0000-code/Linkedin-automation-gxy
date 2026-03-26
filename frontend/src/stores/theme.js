/**
 * Theme Store (Pinia)
 * Manages dark/light mode. Persists to localStorage.
 * Applies 'dark' class to <html> element for Tailwind dark mode.
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const saved = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = ref(saved ? saved === 'dark' : prefersDark)

  function toggle() {
    isDark.value = !isDark.value
  }

  function setTheme(dark) {
    isDark.value = dark
  }

  // Apply class to <html> whenever isDark changes
  watch(isDark, (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, { immediate: true })

  return { isDark, toggle, setTheme }
})
