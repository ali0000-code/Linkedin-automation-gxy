<template>
  <div class="min-h-screen bg-theme-muted transition-colors duration-300">
    <Sidebar />
    <main class="ml-[16.5rem] min-h-screen">
      <div class="p-8 max-w-7xl">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup>
import Sidebar from './Sidebar.vue'
</script>
