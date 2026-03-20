/**
 * UI Store (Zustand)
 *
 * Global state management for UI-related state (modals, sidebars, etc.)
 */

import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Modals
  isProspectModalOpen: false,
  isTagModalOpen: false,
  isDeleteModalOpen: false,

  // Current editing item
  editingProspect: null,
  editingTag: null,
  deletingItem: null,

  // Sidebar state (for mobile)
  isSidebarOpen: false,

  /**
   * Open prospect modal (for create or edit)
   * @param {object|null} prospect - Prospect to edit, or null for create
   */
  openProspectModal: (prospect = null) => set({
    isProspectModalOpen: true,
    editingProspect: prospect
  }),

  /**
   * Close prospect modal
   */
  closeProspectModal: () => set({
    isProspectModalOpen: false,
    editingProspect: null
  }),

  /**
   * Open tag modal (for create or edit)
   * @param {object|null} tag - Tag to edit, or null for create
   */
  openTagModal: (tag = null) => set({
    isTagModalOpen: true,
    editingTag: tag
  }),

  /**
   * Close tag modal
   */
  closeTagModal: () => set({
    isTagModalOpen: false,
    editingTag: null
  }),

  /**
   * Open delete confirmation modal
   * @param {object} item - Item to delete (with type and id)
   */
  openDeleteModal: (item) => set({
    isDeleteModalOpen: true,
    deletingItem: item
  }),

  /**
   * Close delete confirmation modal
   */
  closeDeleteModal: () => set({
    isDeleteModalOpen: false,
    deletingItem: null
  }),

  /**
   * Toggle sidebar (for mobile menu)
   */
  toggleSidebar: () => set((state) => ({
    isSidebarOpen: !state.isSidebarOpen
  })),

  /**
   * Close sidebar
   */
  closeSidebar: () => set({ isSidebarOpen: false }),

  // Selected prospects (persists across pagination)
  selectedProspects: [],

  /**
   * Toggle prospect selection
   * @param {number} prospectId - Prospect ID to toggle
   */
  toggleProspect: (prospectId) => set((state) => ({
    selectedProspects: state.selectedProspects.includes(prospectId)
      ? state.selectedProspects.filter((id) => id !== prospectId)
      : [...state.selectedProspects, prospectId]
  })),

  /**
   * Set selected prospects (for select all)
   * @param {array} prospectIds - Array of prospect IDs
   */
  setSelectedProspects: (prospectIds) => set({ selectedProspects: prospectIds }),

  /**
   * Clear selected prospects
   */
  clearSelectedProspects: () => set({ selectedProspects: [] }),
}));
