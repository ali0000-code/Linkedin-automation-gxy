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

// Global flag to stop extraction
let shouldStopExtraction = false;

/**
 * Stop the current extraction
 */
function stopExtraction() {
  shouldStopExtraction = true;
  console.log('[Extractor] Stop requested by user');
}

/**
 * Extract all profiles from current page
 * Uses data-view-name attribute selector (more stable than class names)
 * @param {number} limit - Maximum number of profiles to extract from this page
 * @param {number} totalCollected - Total already collected (for progress bar)
 * @param {number} totalLimit - Total limit for entire extraction
 * @returns {Promise<Array<object>>} Array of prospect objects
 */
async function extractProfiles(limit = 100, totalCollected = 0, totalLimit = 100) {
  const extracted = [];
  let currentCount = 0;

  console.log(`[Extractor] Starting extraction with limit: ${limit}`);

  // LinkedIn uses data-view-name attributes which are more stable than class names
  // Find all profile links with data-view-name="search-result-lockup-title"
  const profileLinks = document.querySelectorAll('a[data-view-name="search-result-lockup-title"][href*="/in/"]');

  console.log(`[Extractor] Found ${profileLinks.length} profile links using data-view-name selector`);

  // If no profiles found with primary selector, try fallback
  if (profileLinks.length === 0) {
    console.log('[Extractor] Trying fallback selector...');
    const fallbackLinks = document.querySelectorAll('a.app-aware-link[href*="/in/"]');
    console.log(`[Extractor] Found ${fallbackLinks.length} profile links using fallback selector`);
  }

  // Extract data from each profile link
  for (const link of profileLinks) {
    // Check if user requested stop
    if (shouldStopExtraction) {
      console.log('[Extractor] Extraction stopped by user');
      break;
    }

    if (currentCount >= limit) {
      console.log(`[Extractor] Reached limit of ${limit} profiles`);
      break;
    }

    try {
      const profileUrl = link.href;
      const name = link.textContent.trim();

      // Skip if no name or URL
      if (!name || !profileUrl) {
        continue;
      }

      // Find the parent container to extract additional data
      const container = link.closest('div');
      const containerText = container?.textContent || '';

      // Extract profile image - match alt attribute to person's name
      const cardRoot = link.closest('li') || link.closest('div[componentkey]') || container;

      // Use alt attribute matching the person's name to get ONLY their profile picture
      const imgEl = cardRoot?.querySelector(`img[alt="${name}"]`);
      const profileImage = imgEl?.src || null;

      const prospect = {
        full_name: name,
        profile_url: profileUrl,
        linkedin_id: extractLinkedInId(profileUrl),
        profile_image_url: profileImage
      };

      extracted.push(prospect);
      currentCount++;

      // Send progress update to popup with TOTAL progress
      const totalCurrent = totalCollected + currentCount;
      try {
        chrome.runtime.sendMessage({
          type: 'EXTRACTION_PROGRESS',
          current: totalCurrent,
          limit: totalLimit
        });
      } catch (error) {
        // Ignore if popup is closed
        console.warn('[Extractor] Failed to send progress update:', error);
      }

      console.log(`[Extractor] Extracted ${totalCurrent}/${totalLimit}: ${prospect.full_name} - Image: ${!!profileImage}`);

    } catch (error) {
      console.warn('[Extractor] Error extracting profile:', error);
    }
  }

  console.log(`[Extractor] Extraction complete: ${extracted.length} prospects`);

  return extracted;
}

/**
 * Click the Next button to navigate to next page
 * @returns {Promise<boolean>} True if Next button clicked successfully
 */
async function clickNextButton() {
  // Find the Next button using data-testid attribute
  const nextButton = document.querySelector('button[data-testid="pagination-controls-next-button-visible"]');

  console.log('[Extractor] Looking for Next button...');

  if (!nextButton) {
    console.log('[Extractor] No Next button found (reached last page)');
    return false;
  }

  // Check if button is disabled
  const isDisabled = nextButton.disabled || nextButton.getAttribute('aria-disabled') === 'true';
  console.log('[Extractor] Next button disabled:', isDisabled);

  if (isDisabled) {
    console.log('[Extractor] Next button is disabled (reached last page)');
    return false;
  }

  console.log('[Extractor] ✓ Clicking Next button to go to next page');

  // Store current URL to detect change
  const currentUrl = window.location.href;
  const currentPageMatch = currentUrl.match(/[?&]page=(\d+)/);
  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;

  console.log('[Extractor] Current page:', currentPage);

  // Click the button
  nextButton.click();

  // Wait for page navigation
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Wait for new page to load
  let maxWaitAttempts = 20; // 20 seconds max
  let waitAttempt = 0;

  while (waitAttempt < maxWaitAttempts) {
    const newUrl = window.location.href;
    const newPageMatch = newUrl.match(/[?&]page=(\d+)/);
    const newPage = newPageMatch ? parseInt(newPageMatch[1]) : 1;

    // Check if we're on a new page
    if (newUrl !== currentUrl || newPage > currentPage) {
      console.log('[Extractor] ✓ Page navigation detected - moved to page', newPage);

      // Wait for profile links to appear
      const profileLinks = document.querySelectorAll('a[data-view-name="search-result-lockup-title"][href*="/in/"]');

      if (profileLinks.length > 0) {
        console.log('[Extractor] ✓ New page loaded with', profileLinks.length, 'profiles');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Extra wait
        return true;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    waitAttempt++;
  }

  console.warn('[Extractor] ⚠ Timeout waiting for new page');
  return false;
}

/**
 * Extract profiles from My Connections page
 * URL: https://www.linkedin.com/mynetwork/invite-connect/connections/
 * @param {number} limit - Maximum number of profiles to extract
 * @param {number} totalCollected - Total already collected
 * @param {number} totalLimit - Total limit for extraction
 * @returns {Promise<Array<object>>} Array of prospect objects
 */
async function extractFromConnectionsPage(limit = 100, totalCollected = 0, totalLimit = 100) {
  const extracted = [];
  let currentCount = 0;
  const selectors = window.LINKEDIN_SELECTORS?.CONNECTIONS;

  console.log(`[Extractor] Extracting from Connections page with limit: ${limit}`);

  if (!selectors) {
    console.error('[Extractor] Connections selectors not loaded');
    return extracted;
  }

  // Try NEW LinkedIn UI first (2024+) - uses data-view-name attribute
  // Note: Each card has TWO <a data-view-name="connections-profile"> elements:
  //   1. First one contains the profile image
  //   2. Second one contains the name
  // We need to find unique profile URLs and extract from the parent card container

  const connectionCardLinks = document.querySelectorAll(selectors.CONNECTION_CARD_LINK);

  if (connectionCardLinks.length > 0) {
    console.log(`[Extractor] Found ${connectionCardLinks.length} connection card links (new UI)`);

    // Group links by profile URL to deduplicate
    const profileUrlToCard = new Map();

    for (const cardLink of connectionCardLinks) {
      const profileUrl = cardLink.href;
      if (!profileUrl || !profileUrl.includes('/in/')) continue;

      // Find the parent card container (the div that contains both links)
      const cardContainer = cardLink.closest('div[componentkey]') ||
                            cardLink.closest('li') ||
                            cardLink.parentElement?.parentElement;

      if (cardContainer && !profileUrlToCard.has(profileUrl)) {
        profileUrlToCard.set(profileUrl, cardContainer);
      }
    }

    console.log(`[Extractor] Found ${profileUrlToCard.size} unique connection cards`);

    for (const [profileUrl, cardContainer] of profileUrlToCard) {
      if (shouldStopExtraction) break;
      if (currentCount >= limit) break;

      try {
        // Get name from the nested p > a structure (in the second link)
        const nameLink = cardContainer.querySelector('p a[href*="/in/"]');
        let name = nameLink?.textContent?.trim();

        // Fallback: try span with aria-hidden
        if (!name || name.length < 2) {
          const nameSpan = cardContainer.querySelector('span[aria-hidden="true"]');
          name = nameSpan?.textContent?.trim();
        }

        if (!name || name.length < 2) {
          console.log(`[Extractor] Skipping - no name found for ${profileUrl}`);
          continue;
        }

        // Get profile image from the card container
        // The img is inside the FIRST <a> link with a figure element
        let profileImage = null;

        // Method 1: Find img with "'s profile picture" in alt (most reliable)
        const imgWithProfilePicture = cardContainer.querySelector('img[alt*="profile picture"]');

        if (imgWithProfilePicture) {
          profileImage = imgWithProfilePicture.src;
        } else {
          // Method 2: Try to find image by alt starting with first name
          const firstName = name.split(' ')[0];
          const imgByAlt = cardContainer.querySelector(`img[alt^="${firstName}"]`);

          if (imgByAlt) {
            profileImage = imgByAlt.src;
          } else {
            // Method 3: Find any img inside a figure element
            const figureImg = cardContainer.querySelector('figure img');
            profileImage = figureImg?.src || null;
          }
        }

        // Get headline if available
        let headline = null;
        const headlineEl = cardContainer.querySelector('p._5cc1ed84');
        if (headlineEl) {
          headline = headlineEl.textContent?.trim() || null;
        }

        const prospect = {
          full_name: name,
          profile_url: profileUrl,
          linkedin_id: extractLinkedInId(profileUrl),
          headline: headline,
          profile_image_url: profileImage
        };

        extracted.push(prospect);
        currentCount++;

        // Send progress update
        const totalCurrent = totalCollected + currentCount;
        try {
          chrome.runtime.sendMessage({
            type: 'EXTRACTION_PROGRESS',
            current: totalCurrent,
            limit: totalLimit
          });
        } catch (e) { /* ignore */ }

        console.log(`[Extractor] Extracted ${totalCurrent}/${totalLimit}: ${prospect.full_name} - Image: ${profileImage ? 'YES' : 'NO'}`);

      } catch (error) {
        console.warn('[Extractor] Error extracting connection card:', error);
      }
    }

    console.log(`[Extractor] Extracted ${extracted.length} connections (new UI)`);
    return extracted;
  }

  // Fallback to legacy selectors
  let connectionCards = document.querySelectorAll(selectors.CONNECTION_CARD);

  if (connectionCards.length === 0) {
    connectionCards = document.querySelectorAll(selectors.ALT_CARD);
  }

  // If still no cards, try finding by profile links
  if (connectionCards.length === 0) {
    console.log('[Extractor] Trying to find connections by profile links (legacy)...');
    const profileLinks = document.querySelectorAll('a[href*="/in/"]');
    const uniqueLinks = new Map();

    for (const link of profileLinks) {
      // Skip nav and sidebar links
      if (link.closest('.global-nav') || link.closest('.scaffold-layout__aside')) {
        continue;
      }

      const href = link.href;
      if (href && href.includes('/in/') && !uniqueLinks.has(href)) {
        uniqueLinks.set(href, link);
      }
    }

    console.log(`[Extractor] Found ${uniqueLinks.size} unique profile links`);

    // Extract from links directly
    for (const [href, link] of uniqueLinks) {
      if (shouldStopExtraction) break;
      if (currentCount >= limit) break;

      try {
        const card = link.closest('li') || link.parentElement;
        let name = link.textContent?.trim();

        // Try to get name from nearby elements
        if (!name || name.length < 2) {
          const nameEl = card?.querySelector('.mn-connection-card__name, span[aria-hidden="true"]');
          name = nameEl?.textContent?.trim();
        }

        // Fallback: extract from URL
        if (!name || name.length < 2) {
          const linkedinId = extractLinkedInId(href);
          if (linkedinId) {
            name = linkedinId
              .replace(/-\d+$/, '')
              .replace(/-/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
        }

        if (!name || name.length < 2) continue;

        const imgEl = card?.querySelector('img');
        const profileImage = imgEl?.src || null;

        const prospect = {
          full_name: name,
          profile_url: href,
          linkedin_id: extractLinkedInId(href),
          headline: null,
          profile_image_url: profileImage
        };

        extracted.push(prospect);
        currentCount++;

        const totalCurrent = totalCollected + currentCount;
        try {
          chrome.runtime.sendMessage({
            type: 'EXTRACTION_PROGRESS',
            current: totalCurrent,
            limit: totalLimit
          });
        } catch (e) { /* ignore */ }

        console.log(`[Extractor] Extracted ${totalCurrent}/${totalLimit}: ${prospect.full_name}`);

      } catch (error) {
        console.warn('[Extractor] Error extracting connection:', error);
      }
    }

    return extracted;
  }

  console.log(`[Extractor] Found ${connectionCards.length} connection cards`);

  // Extract from connection cards
  for (const card of connectionCards) {
    if (shouldStopExtraction) break;
    if (currentCount >= limit) break;

    try {
      // Get profile link
      const linkEl = card.querySelector(selectors.PROFILE_LINK) ||
                     card.querySelector(selectors.ALT_PROFILE_LINK) ||
                     card.querySelector('a[href*="/in/"]');

      if (!linkEl || !linkEl.href) continue;

      const profileUrl = linkEl.href;

      // Get name
      const nameEl = card.querySelector(selectors.NAME) ||
                     card.querySelector('span.mn-connection-card__name') ||
                     linkEl;
      const fullName = nameEl?.textContent?.trim();

      if (!fullName || fullName.length < 2) continue;

      // Get occupation/headline
      const occupationEl = card.querySelector(selectors.OCCUPATION);
      const headline = occupationEl?.textContent?.trim() || null;

      // Get profile image
      const imgEl = card.querySelector(selectors.PROFILE_IMAGE) ||
                    card.querySelector(`img[alt="${fullName}"]`);
      const profileImage = imgEl?.src || null;

      const prospect = {
        full_name: fullName,
        profile_url: profileUrl,
        linkedin_id: extractLinkedInId(profileUrl),
        headline: headline,
        profile_image_url: profileImage
      };

      extracted.push(prospect);
      currentCount++;

      // Send progress update
      const totalCurrent = totalCollected + currentCount;
      try {
        chrome.runtime.sendMessage({
          type: 'EXTRACTION_PROGRESS',
          current: totalCurrent,
          limit: totalLimit
        });
      } catch (e) { /* ignore */ }

      console.log(`[Extractor] Extracted ${totalCurrent}/${totalLimit}: ${prospect.full_name}`);

    } catch (error) {
      console.warn('[Extractor] Error extracting connection card:', error);
    }
  }

  console.log(`[Extractor] Extracted ${extracted.length} connections`);
  return extracted;
}

/**
 * Check if current page is the connections page
 * @returns {boolean}
 */
function isConnectionsPage() {
  return window.location.href.includes('linkedin.com/mynetwork/invite-connect/connections');
}

/**
 * Main extraction function with automatic pagination
 * Scrolls page and extracts profiles across multiple pages until limit reached
 * Supports both Search Results and My Connections pages
 * @param {number} limit - Maximum number of profiles to extract
 * @returns {Promise<Array<object>>} Array of prospect objects
 */
async function performExtraction(limit = 100) {
  try {
    // Reset stop flag at start
    shouldStopExtraction = false;

    const allProspects = [];
    let pageCount = 0;

    // Check if we're on the connections page
    if (isConnectionsPage()) {
      console.log(`[Extractor] Detected Connections page - using connections extractor`);

      // Connections page uses infinite scroll, so scroll to load all first
      await scrollToLoadAll();

      // Extract from connections page
      const prospects = await extractFromConnectionsPage(limit, 0, limit);
      return prospects;
    }

    console.log(`[Extractor] Starting multi-page extraction with limit: ${limit}`);

    // Keep extracting from pages until limit reached or no more pages
    while (allProspects.length < limit && !shouldStopExtraction) {
      pageCount++;
      console.log(`[Extractor] ===== Processing Page ${pageCount} =====`);

      // Check for stop before scrolling
      if (shouldStopExtraction) {
        console.log('[Extractor] ✓ Stopped by user before scrolling page', pageCount);
        break;
      }

      // Step 1: Scroll to load all profiles on current page
      await scrollToLoadAll();

      // Check for stop after scrolling
      if (shouldStopExtraction) {
        console.log('[Extractor] ✓ Stopped by user after scrolling page', pageCount);
        break;
      }

      // Step 2: Extract profiles from current page
      const remainingLimit = limit - allProspects.length;
      const totalCollected = allProspects.length;
      const prospects = await extractProfiles(remainingLimit, totalCollected, limit);

      console.log(`[Extractor] Extracted ${prospects.length} prospects from page ${pageCount}`);

      // Add to collection
      allProspects.push(...prospects);

      console.log(`[Extractor] Total collected: ${allProspects.length}/${limit}`);

      // Check if stopped during extraction
      if (shouldStopExtraction) {
        console.log(`[Extractor] ✓ Stopped by user after extracting from page ${pageCount}`);
        break;
      }

      // Check if limit reached
      if (allProspects.length >= limit) {
        console.log(`[Extractor] ✓ Limit reached: ${allProspects.length}/${limit}`);
        break;
      }

      // Try to go to next page
      const hasNextPage = await clickNextButton();

      if (!hasNextPage) {
        console.log('[Extractor] ✓ No more pages available');
        break;
      }

      // Random delay between pages (human-like behavior)
      const delay = 2000 + Math.random() * 1000; // 2-3 seconds
      console.log(`[Extractor] Waiting ${Math.round(delay)}ms before next page...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const stopReason = shouldStopExtraction ? 'Stopped by user' :
                      allProspects.length >= limit ? 'Limit reached' :
                      'No more pages';

    console.log(`[Extractor] ✓ Extraction complete: ${allProspects.length} prospects from ${pageCount} pages (${stopReason})`);
    return allProspects;

  } catch (error) {
    console.error('[Extractor] Extraction failed:', error);
    throw error;
  } finally {
    // Reset stop flag after extraction
    shouldStopExtraction = false;
  }
}

// ==================== EMAIL EXTRACTION ====================

/**
 * Open Contact Info overlay on a profile page
 * @returns {Promise<boolean>} True if overlay opened successfully
 */
async function openContactInfoOverlay() {
  const selectors = window.LINKEDIN_SELECTORS?.CONTACT_INFO;

  if (!selectors) {
    console.error('[Extractor] Contact Info selectors not loaded');
    return false;
  }

  // Find the Contact Info link
  const opener = document.querySelector(selectors.OPENER);

  if (!opener) {
    console.log('[Extractor] Contact Info link not found on this page');
    return false;
  }

  console.log('[Extractor] Opening Contact Info overlay...');
  opener.click();

  // Wait for modal to appear
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 500));

    const modal = document.querySelector(selectors.MODAL);
    if (modal) {
      console.log('[Extractor] Contact Info overlay opened');
      // Give it a moment to fully render
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }

    attempts++;
  }

  console.log('[Extractor] Contact Info overlay did not appear');
  return false;
}

/**
 * Extract email from the Contact Info overlay
 * @returns {string|null} Email address or null if not found
 */
function extractEmailFromOverlay() {
  const selectors = window.LINKEDIN_SELECTORS?.CONTACT_INFO;

  if (!selectors) {
    console.error('[Extractor] Contact Info selectors not loaded');
    return null;
  }

  // Try primary selector first
  let emailLink = document.querySelector(selectors.EMAIL_LINK);

  // Try alternative selector
  if (!emailLink) {
    emailLink = document.querySelector(selectors.EMAIL_LINK_ALT);
  }

  // Try finding any mailto link in the modal
  if (!emailLink) {
    const modal = document.querySelector(selectors.MODAL);
    if (modal) {
      emailLink = modal.querySelector('a[href^="mailto:"]');
    }
  }

  if (!emailLink) {
    console.log('[Extractor] No email found in Contact Info');
    return null;
  }

  // Extract email from href="mailto:email@example.com"
  const href = emailLink.getAttribute('href');
  const email = href.replace('mailto:', '').trim();

  console.log('[Extractor] Email found:', email);
  return email;
}

/**
 * Close the Contact Info overlay
 * @returns {Promise<void>}
 */
async function closeContactInfoOverlay() {
  const selectors = window.LINKEDIN_SELECTORS?.CONTACT_INFO;

  // Try to find dismiss button
  const closeButton = document.querySelector(selectors?.CLOSE_BUTTON) ||
                      document.querySelector('button[aria-label="Dismiss"]') ||
                      document.querySelector('.artdeco-modal__dismiss');

  if (closeButton) {
    closeButton.click();
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('[Extractor] Contact Info overlay closed');
  } else {
    // Try pressing Escape key as fallback
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * Extract email from current profile page
 * Opens Contact Info overlay, extracts email, and closes it
 * @returns {Promise<{success: boolean, email: string|null}>}
 */
async function extractEmailFromProfile() {
  try {
    // Check if we're on a profile page
    if (!window.location.href.includes('linkedin.com/in/')) {
      return { success: false, email: null, error: 'Not on a profile page' };
    }

    // Open the Contact Info overlay
    const opened = await openContactInfoOverlay();

    if (!opened) {
      return { success: false, email: null, error: 'Could not open Contact Info' };
    }

    // Extract email
    const email = extractEmailFromOverlay();

    // Close the overlay
    await closeContactInfoOverlay();

    if (email) {
      return { success: true, email: email };
    } else {
      return { success: true, email: null, error: 'No email found for this user' };
    }

  } catch (error) {
    console.error('[Extractor] Error extracting email:', error);
    // Try to close overlay if it's open
    await closeContactInfoOverlay();
    return { success: false, email: null, error: error.message };
  }
}

/**
 * Extract emails from multiple profile URLs
 * Navigates to each profile, extracts email, and returns results
 * @param {Array<{id: number, profile_url: string, full_name: string}>} prospects - Array of prospects to extract emails from
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{withEmail: Array, withoutEmail: Array}>}
 */
async function extractEmailsFromProspects(prospects, onProgress) {
  const withEmail = [];
  const withoutEmail = [];
  let processed = 0;

  console.log(`[Extractor] Starting email extraction for ${prospects.length} prospects`);

  for (const prospect of prospects) {
    if (shouldStopExtraction) {
      console.log('[Extractor] Email extraction stopped by user');
      break;
    }

    processed++;

    // Report progress
    if (onProgress) {
      onProgress({
        current: processed,
        total: prospects.length,
        prospect: prospect.full_name
      });
    }

    try {
      // Navigate to profile page
      console.log(`[Extractor] Processing ${processed}/${prospects.length}: ${prospect.full_name}`);

      // If we're already on this profile page, extract directly
      if (window.location.href.includes(prospect.linkedin_id || extractLinkedInId(prospect.profile_url))) {
        const result = await extractEmailFromProfile();

        if (result.email) {
          withEmail.push({ ...prospect, email: result.email });
        } else {
          withoutEmail.push(prospect);
        }
      } else {
        // We need to navigate - this should be handled by the caller
        // since we can't navigate to another page from content script easily
        console.log(`[Extractor] Skipping ${prospect.full_name} - not on their profile page`);
        withoutEmail.push({ ...prospect, skipped: true });
      }

      // Small delay between extractions
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`[Extractor] Error processing ${prospect.full_name}:`, error);
      withoutEmail.push({ ...prospect, error: error.message });
    }
  }

  console.log(`[Extractor] Email extraction complete: ${withEmail.length} with email, ${withoutEmail.length} without`);

  return { withEmail, withoutEmail };
}
