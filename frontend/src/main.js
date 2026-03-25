/**
 * Application entry point.
 * Sets up Vue app with Pinia (state), Vue Router, and TanStack Vue Query.
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import './index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        staleTime: 30000,
      },
      mutations: {
        retry: 0,
      },
    },
  },
})

app.mount('#app')
