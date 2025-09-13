// utils/instagramScraper.js
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config();

const IG_USER = process.env.IG_USER;
const IG_PASS = process.env.IG_PASS;

if (!IG_USER || !IG_PASS) {
  throw new Error("IG_USER and IG_PASS environment variables required");
}

async function login(page) {
  try {
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
    });

    // Wait for login form to load
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });

    // Clear any existing text and type credentials
    await page.click('input[name="username"]', { clickCount: 3 });
    await page.type('input[name="username"]', IG_USER, { delay: 50 });
    
    await page.click('input[name="password"]', { clickCount: 3 });
    await page.type('input[name="password"]', IG_PASS, { delay: 50 });

    // Wait a bit before submitting
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit form and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);

    // Check if login was successful by looking for Instagram home elements
    await page.waitForSelector('a[href="/"]', { timeout: 10000 });
    
  } catch (error) {
    console.error("Login error:", error.message);
    throw new Error("Failed to login to Instagram: " + error.message);
  }
}

async function scrollModal(page, modalSelector) {
  try {
    const modal = await page.$(modalSelector);
    if (!modal) {
      throw new Error("Modal not found for scrolling");
    }
    
    let lastHeight = await page.evaluate(el => el.scrollHeight, modal);
    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // Prevent infinite scrolling
    
    while (scrollAttempts < maxScrollAttempts) {
      await page.evaluate(el => el.scrollTo(0, el.scrollHeight), modal);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newHeight = await page.evaluate(el => el.scrollHeight, modal);
      if (newHeight === lastHeight) break;
      
      lastHeight = newHeight;
      scrollAttempts++;
    }
  } catch (error) {
    console.error("Error scrolling modal:", error.message);
    throw new Error("Failed to scroll modal: " + error.message);
  }
}

async function scrapeList(page, buttonSelector) {
  try {
    // Click the button to open modal
    await page.click(buttonSelector);
    
    // Wait for modal to appear with multiple possible selectors
    const modalSelectors = [
      'div[role="dialog"] ul',
      'div[role="dialog"] div[style*="overflow"]',
      'div[role="dialog"] div[style*="height"]',
      'div[role="dialog"] > div > div',
      'div[role="dialog"]',
      'div[role="dialog"] div[style*="max-height"]',
      'div[role="dialog"] div[style*="scroll"]',
      'div[role="dialog"] div[data-testid]',
      'div[role="dialog"] section',
      'div[role="dialog"] main'
    ];
    
    let modalSelector = null;
    for (const selector of modalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        modalSelector = selector;
        break;
      } catch (e) {
        // Try next selector
        continue;
      }
    }
    
    if (!modalSelector) {
      throw new Error("Could not find modal after clicking button");
    }
    
    // Wait a bit for content to load
    await page.waitForTimeout(2000);
    
    // Scroll to load all content
    await scrollModal(page, modalSelector);
    
    // Extract usernames with multiple possible selectors
    const usernames = await page.evaluate(() => {
      // Try multiple selectors for usernames
      const selectors = [
        'div[role="dialog"] ul li span a',
        'div[role="dialog"] ul li a',
        'div[role="dialog"] div[style*="overflow"] li span a',
        'div[role="dialog"] div[style*="overflow"] li a',
        'div[role="dialog"] li span a',
        'div[role="dialog"] li a',
        'div[role="dialog"] a[href*="/"]',
        'div[role="dialog"] a[href*="instagram.com"]',
        'div[role="dialog"] a[href^="/"]',
        'div[role="dialog"] span a',
        'div[role="dialog"] div a',
        'div[role="dialog"] a'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements)
            .map(el => {
              const text = el.textContent?.trim();
              const href = el.getAttribute('href');
              // Only return valid usernames (not empty, not Instagram links)
              if (text && text.length > 0 && !text.includes('@') && href && href.includes('/')) {
                return text;
              }
              return null;
            })
            .filter(Boolean);
        }
      }
      return [];
    });
    
    if (usernames.length === 0) {
      throw new Error("No usernames found in modal");
    }
    
    // Close modal
    await page.keyboard.press("Escape");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return usernames;
  } catch (error) {
    console.error("Error scraping list:", error.message);
    throw new Error("Failed to scrape list: " + error.message);
  }
}

async function findFollowersFollowingButtons(page, targetUser) {
  // Try multiple selectors for followers and following buttons
  const followersSelectors = [
    `a[href="/${targetUser}/followers/"]`,
    `a[href*="/followers/"]`,
    'a[href$="/followers/"]',
    'a[href*="followers"]',
    'a[aria-label*="followers" i]',
    'a[aria-label*="follower" i]',
    'a[title*="followers" i]',
    'a[title*="follower" i]'
  ];
  
  const followingSelectors = [
    `a[href="/${targetUser}/following/"]`,
    `a[href*="/following/"]`,
    'a[href$="/following/"]',
    'a[href*="following"]',
    'a[aria-label*="following" i]',
    'a[aria-label*="follow" i]',
    'a[title*="following" i]',
    'a[title*="follow" i]'
  ];
  
  let followersButton = await findElementBySelectors(page, followersSelectors);
  let followingButton = await findElementBySelectors(page, followingSelectors);
  
  // If selectors fail, try text-based approach
  if (!followersButton || !followingButton) {
    const textBasedButtons = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      let followersLink = null;
      let followingLink = null;
      
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.toLowerCase() || '';
        const ariaLabel = link.getAttribute('aria-label')?.toLowerCase() || '';
        const title = link.getAttribute('title')?.toLowerCase() || '';
        
        // Check for followers
        if (!followersLink && (
          href.includes('/followers/') ||
          text.includes('followers') ||
          ariaLabel.includes('followers') ||
          title.includes('followers')
        )) {
          followersLink = link;
        }
        
        // Check for following
        if (!followingLink && (
          href.includes('/following/') ||
          text.includes('following') ||
          ariaLabel.includes('following') ||
          title.includes('following')
        )) {
          followingLink = link;
        }
      }
      
      return { followersLink, followingLink };
    });
    
    if (textBasedButtons.followersLink) {
      followersButton = textBasedButtons.followersLink;
    }
    if (textBasedButtons.followingLink) {
      followingButton = textBasedButtons.followingLink;
    }
  }
  
  if (!followersButton) {
    throw new Error("Could not find followers button with any method");
  }
  if (!followingButton) {
    throw new Error("Could not find following button with any method");
  }
  
  return { followersButton, followingButton };
}

async function findElementBySelectors(page, selectors) {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
    } catch (e) {
      // Try next selector
      continue;
    }
  }
  return null;
}

async function scrapeInstagram(targetUser) {
  let browser = null;
  try {
    console.log(`Starting scrape for user: ${targetUser}`);
    browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // 1. Login
    console.log('Logging in...');
    await login(page);

    // 2. Navigate to target profile
    console.log(`Navigating to https://www.instagram.com/${targetUser}/`);
    await page.goto(`https://www.instagram.com/${targetUser}/`, {
      waitUntil: "networkidle2",
    });

    // 3. Check if private
    console.log('Checking if account is private...');
    const isPrivate = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      if (text.includes('this account is private') || text.includes('this account is private')) {
        return true;
      }
      
      const privateElements = document.querySelectorAll('h2, div[role="button"]');
      for (const el of privateElements) {
        if (el.innerText.toLowerCase().includes('private')) {
          return true;
        }
      }
      
      return false;
    });

    if (isPrivate) {
      console.log('Account is private');
      await browser.close();
      return { private: true };
    }

    // 4. Find followers and following buttons
    console.log('Looking for followers/following buttons...');
    const { followersButton, followingButton } = await findFollowersFollowingButtons(page, targetUser);

    // 5. Scrape followers and following
    console.log('Scraping followers...');
    const followers = await scrapeList(page, followersButton);
    console.log(`Found ${followers.length} followers`);
    
    console.log('Scraping following...');
    const following = await scrapeList(page, followingButton);
    console.log(`Found ${following.length} following`);

    await browser.close();
    console.log('Scraping completed successfully');
    return { followers, following, private: false };
    
  } catch (error) {
    console.error("Error in scrapeInstagram:", error.message);
    console.error("Stack trace:", error.stack);
    if (browser) {
      await browser.close();
    }
    throw new Error("Failed to scrape Instagram account: " + error.message);
  }
}

export { scrapeInstagram };