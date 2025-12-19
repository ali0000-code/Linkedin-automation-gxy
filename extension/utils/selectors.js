/**
 * LinkedIn DOM Selectors
 *
 * Based on reference extension analysis - exact selectors that work.
 *
 * @module utils/selectors
 */

const LINKEDIN_SELECTORS = {
  /**
   * Main Profile Action Container
   * CRITICAL: Must find the correct container to avoid clicking duplicate buttons
   */
  PROFILE: {
    // Container selectors (try in order)
    ACTION_CONTAINERS: [
      '.pv-top-card-v2-ctas',
      '.pvs-profile-actions',
      '[class*="profile-actions"]'
    ],

    // Validation: container must have at least one of these buttons
    ACTION_BUTTON_CHECK: 'button[aria-label*="Message"], button[aria-label*="Connect"], button[aria-label*="Follow"], button[aria-label*="More"]',

    // Fallback container detection
    FALLBACK_SECTIONS: 'section, div[class*="pv-top"]',

    // Connect button (visible state - primary button)
    CONNECT_BUTTON: 'button[aria-label*="Invite"][aria-label*="connect"].artdeco-button--primary',

    // More actions button
    MORE_BUTTON: 'button[aria-label="More actions"]',

    // Connect option in dropdown (div with role="button", appears in body not container)
    DROPDOWN_CONNECT: '.artdeco-dropdown__content div[aria-label*="Invite"][aria-label*="connect"][role="button"]',

    // Follow option in dropdown
    DROPDOWN_FOLLOW: '.artdeco-dropdown__content div[aria-label*="Follow"][role="button"]',

    // Message button
    MESSAGE_BUTTON: 'button[aria-label*="Message"]',

    // Follow button (visible state)
    FOLLOW_BUTTON: 'button[aria-label*="Follow"]',

    // Pending connection indicator
    PENDING_BUTTON: 'button[aria-label*="Pending"]'
  },

  /**
   * Connection Request Modal
   */
  CONNECTION_MODAL: {
    // Add a note button
    ADD_NOTE_BUTTON: 'button[aria-label="Add a note"]',

    // Send without a note button
    SEND_WITHOUT_NOTE: 'button[aria-label="Send without a note"]',

    // Note textarea (after clicking Add a note)
    NOTE_TEXTAREA: 'textarea[name="message"]',

    // Send invitation button (after adding note)
    SEND_BUTTON: 'button[aria-label="Send invitation"]',

    // Dismiss/close modal button
    DISMISS_BUTTON: 'button[aria-label="Dismiss"]'
  },

  /**
   * Message Compose
   */
  MESSAGE: {
    // Message textbox (contenteditable div)
    TEXTBOX: '.msg-form__contenteditable[contenteditable="true"][role="textbox"]',

    // Close button (SVG inside button)
    CLOSE_BUTTON_SVG: 'button.msg-overlay-bubble-header__control svg[data-test-icon="close-small"]',

    // Close button fallback (button class)
    CLOSE_BUTTON: 'button.msg-overlay-bubble-header__control'
  },

  /**
   * Search Results Page Selectors
   */
  SEARCH: {
    RESULTS_CONTAINER: '.search-results-container',
    PROFILE_CARD: '.reusable-search__result-container',
    PROFILE_LINK: 'a[data-view-name="search-result-lockup-title"][href*="/in/"]',
    PROFILE_LINK_ALT: 'a.app-aware-link[href*="/in/"]',
    PROFILE_NAME: '.entity-result__title-text a span[aria-hidden="true"]',
    PROFILE_NAME_ALT: '.entity-result__title-text .t-roman',
    HEADLINE: '.entity-result__primary-subtitle',
    LOCATION: '.entity-result__secondary-subtitle',
    PAGINATION: {
      CONTAINER: '.artdeco-pagination',
      NEXT_BUTTON: 'button[aria-label="Next"]',
      PREV_BUTTON: 'button[aria-label="Previous"]'
    }
  },

  /**
   * My Connections Page Selectors
   * URL: https://www.linkedin.com/mynetwork/invite-connect/connections/
   */
  CONNECTIONS: {
    // Main container for connections list
    CONTAINER: '.mn-connections',

    // NEW LinkedIn UI (2024+) - uses data-view-name attribute
    // Each connection card link
    CONNECTION_CARD_LINK: 'a[data-view-name="connections-profile"]',
    // Profile image inside the card
    CARD_PROFILE_IMAGE: 'a[data-view-name="connections-profile"] img',
    // Name link inside the card (nested p > a structure)
    CARD_NAME_LINK: 'a[data-view-name="connections-profile"] p a',

    // Legacy selectors (older LinkedIn UI)
    CONNECTION_CARD: '.mn-connection-card',
    PROFILE_LINK: '.mn-connection-card__link',
    NAME: '.mn-connection-card__name',
    OCCUPATION: '.mn-connection-card__occupation',
    PROFILE_IMAGE: '.mn-connection-card__picture img, .presence-entity__image',

    // Load more button (if exists)
    LOAD_MORE_BUTTON: 'button.scaffold-finite-scroll__load-button',

    // Alternative selectors
    ALT_PROFILE_LINK: 'a.ember-view[href*="/in/"]',
    ALT_CARD: 'li.mn-connection-card'
  },

  /**
   * Current User Detection (for account verification)
   */
  CURRENT_USER: {
    ME_BUTTON: '.global-nav__me-trigger',
    ME_BUTTON_ALT: '.global-nav__me',
    DROPDOWN_PROFILE: '.global-nav__me-content a[href*="/in/"]',
    FEED_PROFILE: '.feed-identity-module a[href*="/in/"]'
  },

  /**
   * Contact Info Extraction (for email)
   * Opens from profile page top card
   */
  CONTACT_INFO: {
    // Contact info link opener (on profile page)
    OPENER: 'a[href*="overlay/contact-info"]',

    // Modal/overlay that appears
    MODAL: '.artdeco-modal__content',
    MODAL_HEADER: '.artdeco-modal__header',

    // Close button for the modal
    CLOSE_BUTTON: 'button[aria-label="Dismiss"]',

    // Email section and link
    EMAIL_SECTION: 'section.ci-email',
    EMAIL_LINK: 'section.ci-email a[href^="mailto:"]',

    // Alternative selectors for email
    EMAIL_SECTION_ALT: 'section[class*="email"]',
    EMAIL_LINK_ALT: 'a[href^="mailto:"]',

    // Profile URL section
    PROFILE_SECTION: 'section.ci-vanity-url',
    PROFILE_LINK: 'section.ci-vanity-url a[href*="linkedin.com/in/"]',

    // Connected date section
    CONNECTED_SECTION: 'section.ci-connected',

    // Birthday section
    BIRTHDAY_SECTION: 'section.ci-birthday'
  }
};

// Make selectors available globally
if (typeof window !== 'undefined') {
  window.LINKEDIN_SELECTORS = LINKEDIN_SELECTORS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LINKEDIN_SELECTORS;
}
