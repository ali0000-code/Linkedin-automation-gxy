/**
 * LinkedIn Extractor Service
 *
 * Core extraction logic for scraping prospect data from LinkedIn pages.
 * Handles scrolling to load all results and extracting profile information.
 */

/**
 * Scroll page to load all lazy-loaded content
 * LinkedIn uses infinite scroll, so we need to scroll to bottom multiple times
 * @returns {Promise<void>}
 */
async function scrollToLoadAll() {
  let previousHeight = 0;
  let currentHeight = document.body.scrollHeight;
  let attempts = 0;
  const maxAttempts = 50; // Prevent infinite loop
  const scrollDelay = 1000; // Wait 1 second between scrolls

  console.log('[Extractor] Starting auto-scroll to load all profiles...');

  while (previousHeight !== currentHeight && attempts < maxAttempts) {
    // Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);

    // Wait for LinkedIn to load more content
    await new Promise(resolve => setTimeout(resolve, scrollDelay));

    previousHeight = currentHeight;
    currentHeight = document.body.scrollHeight;
    attempts++;

    console.log(`[Extractor] Scroll attempt ${attempts}: Height ${currentHeight}px`);
  }

  // Scroll back to top for better UX
  window.scrollTo(0, 0);

  console.log(`[Extractor] Scrolling complete after ${attempts} attempts`);
}

/**
 * Extract LinkedIn ID from profile URL
 * @param {string} profileUrl - Full LinkedIn profile URL
 * @returns {string|null} LinkedIn ID (e.g., "john-doe-123456") or null
 */
function extractLinkedInId(profileUrl) {
  // Extract ID from URL like: https://www.linkedin.com/in/john-doe-123456/
  const match = profileUrl.match(/\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}

/**
 * Extract data from a single profile card
 * @param {HTMLElement} card - Profile card DOM element
 * @param {object} selectors - Selector object from LINKEDIN_SELECTORS
 * @returns {object|null} Prospect data or null if invalid
 */
function extractProfileFromCard(card, selectors) {
  try {
    // Extract name (required)
    let nameEl = card.querySelector(selectors.PROFILE_NAME);
    if (!nameEl) {
      nameEl = card.querySelector(selectors.PROFILE_NAME_ALT);
    }

    // Extract profile link (required)
    const linkEl = card.querySelector(selectors.PROFILE_LINK);

    // Both name and link are required
    if (!nameEl || !linkEl) {
      return null;
    }

    const fullName = nameEl.textContent.trim();
    const profileUrl = linkEl.href;

    // Skip if name or URL is empty
    if (!fullName || !profileUrl) {
      return null;
    }

    // Extract optional fields
    const headlineEl = card.querySelector(selectors.HEADLINE);
    const locationEl = card.querySelector(selectors.LOCATION);

    // Try to get profile image
    let imageEl = card.querySelector(selectors.PROFILE_IMAGE);
    if (!imageEl) {
      imageEl = card.querySelector(selectors.PROFILE_IMAGE_ALT);
    }

    // Build prospect object
    const prospect = {
      full_name: fullName,
      profile_url: profileUrl,
      linkedin_id: extractLinkedInId(profileUrl),
      headline: headlineEl ? headlineEl.textContent.trim() : null,
      location: locationEl ? locationEl.textContent.trim() : null,
      company: null, // Will extract from headline if available
      profile_image_url: imageEl ? imageEl.src : null
    };

    // Try to parse company from headline
    // Format is usually: "Job Title at Company Name"
    if (prospect.headline && prospect.headline.includes(' at ')) {
      const parts = prospect.headline.split(' at ');
      if (parts.length >= 2) {
        prospect.company = parts[parts.length - 1].trim();
      }
    }

    return prospect;
  } catch (error) {
    console.error('[Extractor] Error extracting profile from card:', error);
    return null;
  }
}

/**
 * Extract all profiles from current page
 * @param {number} limit - Maximum number of profiles to extract
 * @returns {Promise<Array<object>>} Array of prospect objects
 */
async function extractProfiles(limit = 100) {
  const selectors = window.LINKEDIN_SELECTORS.SEARCH;
  const extracted = [];
  let currentCount = 0;

  console.log(`[Extractor] Starting extraction with limit: ${limit}`);

  // Find all profile cards on page
  const profileCards = document.querySelectorAll(selectors.PROFILE_CARD);
  console.log(`[Extractor] Found ${profileCards.length} profile cards`);

  // Extract data from each card
  for (const card of profileCards) {
    if (currentCount >= limit) {
      console.log(`[Extractor] Reached limit of ${limit} profiles`);
      break;
    }

    const prospect = extractProfileFromCard(card, selectors);

    if (prospect) {
      extracted.push(prospect);
      currentCount++;

      // Send progress update to popup
      try {
        chrome.runtime.sendMessage({
          type: 'EXTRACTION_PROGRESS',
          current: currentCount,
          limit: limit
        });
      } catch (error) {
        // Ignore if popup is closed
        console.warn('[Extractor] Failed to send progress update:', error);
      }

      console.log(`[Extractor] Extracted ${currentCount}/${limit}: ${prospect.full_name}`);
    }
  }

  console.log(`[Extractor] Extraction complete: ${extracted.length} prospects`);

  return extracted;
}

/**
 * Main extraction function
 * Scrolls page and extracts all profiles
 * @param {number} limit - Maximum number of profiles to extract
 * @returns {Promise<Array<object>>} Array of prospect objects
 */
async function performExtraction(limit = 100) {
  try {
    // Step 1: Scroll to load all profiles
    await scrollToLoadAll();

    // Step 2: Extract profiles with progress updates
    const prospects = await extractProfiles(limit);

    return prospects;
  } catch (error) {
    console.error('[Extractor] Extraction failed:', error);
    throw error;
  }
}
