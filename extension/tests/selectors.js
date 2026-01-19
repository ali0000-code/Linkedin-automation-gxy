/**
 * LinkedIn DOM Selectors for Testing
 *
 * This is a copy of the extension's selectors for use in Playwright tests.
 * Keep this in sync with ../utils/selectors.js
 */

const LINKEDIN_SELECTORS = {
  /**
   * Main Profile Action Container
   */
  PROFILE: {
    // Profile action container (where Connect/Message/Follow buttons are)
    ACTION_CONTAINER: '[class*="profile-actions"]',
    ACTION_BUTTON_CHECK: 'button[aria-label*="Message"], button[aria-label*="Connect"], button[aria-label*="Follow"], button[aria-label*="More"]',
    FALLBACK_SECTIONS: 'section, div[class*="pv-top"]',
    CONNECT_BUTTON: 'button[aria-label*="Invite"][aria-label*="connect"].artdeco-button--primary',
    MORE_BUTTON: 'button[aria-label="More actions"]',
    DROPDOWN_CONNECT: '.artdeco-dropdown__content div[aria-label*="Invite"][aria-label*="connect"][role="button"]',
    DROPDOWN_FOLLOW: '.artdeco-dropdown__content div[aria-label*="Follow"][role="button"]',
    MESSAGE_BUTTON: 'button[aria-label*="Message"].artdeco-button',
    FOLLOW_BUTTON: 'button[aria-label*="Follow"].artdeco-button--secondary',
    PENDING_BUTTON: 'button[aria-label*="Pending"].artdeco-button'
  },

  /**
   * Connection Request Modal
   */
  CONNECTION_MODAL: {
    ADD_NOTE_BUTTON: 'button[aria-label="Add a note"]',
    SEND_WITHOUT_NOTE: 'button[aria-label="Send without a note"]',
    NOTE_TEXTAREA: 'textarea[name="message"]',
    SEND_BUTTON: 'button[aria-label="Send invitation"]',
    DISMISS_BUTTON: 'button[aria-label="Dismiss"]'
  },

  /**
   * Message Compose
   */
  MESSAGE: {
    TEXTBOX: '.msg-form__contenteditable[contenteditable="true"][role="textbox"]',
    CLOSE_BUTTON_SVG: 'button.msg-overlay-bubble-header__control svg[data-test-icon="close-small"]',
    CLOSE_BUTTON: 'button.msg-overlay-bubble-header__control'
  },

  /**
   * Search Results Page
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
    PROFILE_IMAGE: 'figure[data-view-name="image"] img, img[src*="profile-displayphoto"], img[src*="media.licdn.com/dms/image"]',
    PROFILE_IMAGE_ALT: '.entity-result__image img, img.presence-entity__image, .ivm-view-attr__img-wrapper img',
    PAGINATION: {
      CONTAINER: '.artdeco-pagination',
      NEXT_BUTTON: 'button[aria-label="Next"]',
      PREV_BUTTON: 'button[aria-label="Previous"]'
    }
  },

  /**
   * My Connections Page
   */
  CONNECTIONS: {
    CONTAINER: '.mn-connections',
    CONNECTION_CARD_LINK: 'a[data-view-name="connections-profile"]',
    CARD_PROFILE_IMAGE: 'a[data-view-name="connections-profile"] img',
    CARD_NAME_LINK: 'a[data-view-name="connections-profile"] p a',
    CONNECTION_CARD: '.mn-connection-card',
    PROFILE_LINK: '.mn-connection-card__link',
    NAME: '.mn-connection-card__name',
    OCCUPATION: '.mn-connection-card__occupation',
    PROFILE_IMAGE: '.mn-connection-card__picture img, .presence-entity__image',
    LOAD_MORE_BUTTON: 'button.scaffold-finite-scroll__load-button',
    ALT_PROFILE_LINK: 'a.ember-view[href*="/in/"]',
    ALT_CARD: 'li.mn-connection-card'
  },

  /**
   * Current User Detection
   */
  CURRENT_USER: {
    ME_BUTTON: '.global-nav__me-trigger',
    ME_BUTTON_ALT: '.global-nav__me',
    DROPDOWN_PROFILE: '.global-nav__me-content a[href*="/in/"]',
    FEED_PROFILE: '.feed-identity-module a[href*="/in/"]'
  },

  /**
   * Messaging / Inbox
   */
  MESSAGING: {
    CONVERSATION_LIST_CONTAINERS: [
      '.msg-conversations-container__conversations-list',
      '.msg-conversations-container',
      '[class*="msg-conversations-container"]'
    ],
    CONVERSATION_ITEMS: [
      'li.msg-conversation-listitem',
      '.msg-conversations-container__convo-item-link',
      '.msg-conversation-listitem__link'
    ],
    CONVERSATION_LINK_DIV: [
      '.msg-conversation-listitem__link',
      '.msg-conversations-container__convo-item-link'
    ],
    PARTICIPANT_NAME: [
      'h3.msg-conversation-listitem__participant-names',
      '.msg-conversation-card__participant-names',
      'h3.msg-conversation-card__participant-names'
    ],
    AVATAR: [
      'img.presence-entity__image',
      '.presence-entity__image',
      '.msg-selectable-entity__entity img'
    ],
    MESSAGE_PREVIEW: [
      'p.msg-conversation-card__message-snippet',
      '.msg-conversation-card__message-snippet',
      '.msg-conversation-card__message-snippet-container p'
    ],
    TIMESTAMP: [
      'time.msg-conversation-listitem__time-stamp',
      'time.msg-conversation-card__time-stamp',
      '.msg-conversation-card__time-stamp'
    ],
    UNREAD_COUNT: [
      '.msg-conversation-listitem__unread-count',
      '.msg-conversation-card__unread-count'
    ],
    MESSAGE_LIST: [
      '.msg-s-message-list',
      'ul.msg-s-message-list'
    ],
    MESSAGE_ITEM: [
      'li.msg-s-message-list__event',
      '.msg-s-event-listitem'
    ],
    MESSAGE_CONTENT: [
      'p.msg-s-event-listitem__body',
      '.msg-s-event-listitem__body',
      '.msg-s-event__content p'
    ],
    MESSAGE_SENDER: [
      '.msg-s-message-group__profile-link',
      '.msg-s-message-group__name',
      'span.msg-s-message-group__name'
    ],
    MESSAGE_TIMESTAMP: [
      'time.msg-s-message-group__timestamp',
      '.msg-s-message-group__timestamp'
    ],
    MESSAGE_URN_ATTR: 'data-event-urn',
    MESSAGE_INPUT: [
      '.msg-form__contenteditable',
      '[contenteditable="true"][role="textbox"]'
    ],
    SEND_BUTTON: [
      '.msg-form__send-button',
      'button.msg-form__send-button'
    ]
  },

  /**
   * Contact Info Modal
   */
  CONTACT_INFO: {
    OPENER: 'a[href*="overlay/contact-info"]',
    MODAL: '.artdeco-modal__content',
    MODAL_HEADER: '.artdeco-modal__header',
    CLOSE_BUTTON: 'button[aria-label="Dismiss"]',
    EMAIL_LINK: 'a[href^="mailto:"]',
    PROFILE_LINK: 'a[href*="linkedin.com/in/"]'
  }
};

module.exports = LINKEDIN_SELECTORS;
