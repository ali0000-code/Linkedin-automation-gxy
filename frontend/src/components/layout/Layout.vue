<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <Sidebar />

    <!-- Main Content -->
    <main class="ml-64 min-h-screen">
      <div class="p-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup>
import Sidebar from './Sidebar.vue'
</script>
