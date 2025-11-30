/**
 * LinkedIn DOM Selectors
 *
 * These selectors are built specifically for extracting prospect data
 * from LinkedIn search results pages. Inspired by patterns from previous
 * implementation but tailored for our specific extraction needs.
 *
 * NOTE: LinkedIn may update their DOM structure. If extraction fails,
 * inspect the page and update these selectors accordingly.
 *
 * @module utils/selectors
 */

const LINKEDIN_SELECTORS = {
  /**
   * Search Results Page Selectors
   * Used on: linkedin.com/search/results/people/
   */
  SEARCH: {
    // Main container for all search results
    RESULTS_CONTAINER: '.search-results-container',

    // Individual profile card (each search result)
    PROFILE_CARD: '.reusable-search__result-container',

    // Profile link (contains LinkedIn URL)
    PROFILE_LINK: 'a.app-aware-link[href*="/in/"]',

    // Full name
    PROFILE_NAME: '.entity-result__title-text a span[aria-hidden="true"]',

    // Alternative name selector (fallback)
    PROFILE_NAME_ALT: '.entity-result__title-text .t-roman',

    // Headline (job title)
    HEADLINE: '.entity-result__primary-subtitle',

    // Location
    LOCATION: '.entity-result__secondary-subtitle',

    // Company name (sometimes part of headline)
    COMPANY: '.entity-result__primary-subtitle',

    // Profile image
    PROFILE_IMAGE: 'img.EntityPhoto-circle-5',

    // Alternative image selector
    PROFILE_IMAGE_ALT: '.presence-entity__image',

    // Connection degree badge (1st, 2nd, 3rd)
    DEGREE_BADGE: '.entity-result__badge-text',

    // Pagination
    PAGINATION: {
      CONTAINER: '.artdeco-pagination',
      NEXT_BUTTON: 'button[aria-label="Next"]',
      PREV_BUTTON: 'button[aria-label="Previous"]',
      PAGE_BUTTON: '.artdeco-pagination__indicator button'
    }
  },

  /**
   * Generic selectors that might be useful
   */
  COMMON: {
    // Loading spinners
    LOADING_SPINNER: '.artdeco-loader',

    // Empty results message
    NO_RESULTS: '.search-results__no-results',

    // Error messages
    ERROR_MESSAGE: '.artdeco-inline-feedback--error'
  }
};

// Make selectors available globally for content scripts
if (typeof window !== 'undefined') {
  window.LINKEDIN_SELECTORS = LINKEDIN_SELECTORS;
}

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LINKEDIN_SELECTORS;
}
