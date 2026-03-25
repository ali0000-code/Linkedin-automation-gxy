/**
 * Vue Router configuration.
 * Protected routes redirect to /login if not authenticated.
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  // Public routes
  { path: '/login', name: 'Login', component: () => import('../pages/Login.vue'), meta: { public: true } },
  { path: '/auth/callback', name: 'AuthCallback', component: () => import('../pages/LinkedInCallback.vue'), meta: { public: true } },

  // Protected routes
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: () => import('../pages/Dashboard.vue') },
  { path: '/prospects', name: 'Prospects', component: () => import('../pages/Prospects.vue') },
  { path: '/campaigns', name: 'Campaigns', component: () => import('../pages/CampaignsList.vue') },
  { path: '/campaigns/create', name: 'CampaignCreate', component: () => import('../pages/CampaignCreate.vue') },
  { path: '/campaigns/:id', name: 'CampaignDetails', component: () => import('../pages/CampaignDetails.vue') },
  { path: '/templates', name: 'Templates', component: () => import('../pages/MessageTemplates.vue') },
  { path: '/mail', name: 'Mail', component: () => import('../pages/Mail.vue') },
  { path: '/inbox', name: 'Inbox', component: () => import('../pages/Inbox.vue') },
  { path: '/settings', name: 'Settings', component: () => import('../pages/Settings.vue') },

  // 404
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../pages/NotFound.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard: redirect to login if not authenticated
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'Login' }
  }
  if (to.meta.public && auth.isAuthenticated && to.name === 'Login') {
    return { name: 'Dashboard' }
  }
})

export default router
