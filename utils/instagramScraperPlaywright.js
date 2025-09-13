// utils/instagramScraperPlaywright.js
import dotenv from "dotenv";
import { chromium } from 'playwright';
import { addExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

dotenv.config();

const IG_USER = process.env.IG_USER;
const IG_PASS = process.env.IG_PASS;

if (!IG_USER || !IG_PASS) {
  throw new Error("IG_USER and IG_PASS environment variables required");
}

// Add stealth plugin
const playwright = addExtra(chromium);
playwright.use(StealthPlugin());

// Utility function for random delays
const randomDelay = (min = 1000, max = 3000) => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
};

// Human-like typing
const humanType = async (page, selector, text) => {
  await page.click(selector);
  await randomDelay(500, 1000);
  
  for (const char of text) {
    await page.keyboard.type(char);
    await randomDelay(50, 150);
  }
};

async function login(page) {
  try {
    console.log('🔐 Starting login process...');
    
    // Go to Instagram homepage first
    await page.goto("https://www.instagram.com/", {
      waitUntil: "networkidle",
      timeout: 30000
    });
    
    await randomDelay(2000, 4000);
    
    // Look for login link or button
    const loginSelectors = [
      'a[href="/accounts/login/"]',
      'button:has-text("Log in")',
      'a:has-text("Log in")',
      '[data-testid="login-button"]'
    ];
    
    let loginElement = null;
    for (const selector of loginSelectors) {
      try {
        loginElement = await page.$(selector);
        if (loginElement) {
          console.log(`Found login element: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (loginElement) {
      await loginElement.click();
      await randomDelay(2000, 3000);
    } else {
      // Try direct navigation
      await page.goto("https://www.instagram.com/accounts/login/", {
        waitUntil: "networkidle",
        timeout: 30000
      });
    }
    
    // Wait for login form
    console.log('⏳ Waiting for login form...');
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });
    
    // Human-like login
    console.log('⌨️ Filling credentials...');
    await humanType(page, 'input[name="username"]', IG_USER);
    await randomDelay(1000, 2000);
    await humanType(page, 'input[name="password"]', IG_PASS);
    await randomDelay(1000, 2000);
    
    // Submit form
    console.log('📤 Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Verify login success
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);
    
    if (currentUrl.includes('/accounts/login/')) {
      // Check for error messages
      const errorMessages = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('[role="alert"], .error, .alert');
        return Array.from(errorElements).map(el => el.textContent?.trim()).filter(Boolean);
      });
      
      if (errorMessages.length > 0) {
        throw new Error(`Login failed: ${errorMessages.join(', ')}`);
      } else {
        throw new Error('Login failed: Still on login page');
      }
    }
    
    console.log('✅ Login successful');
    
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
    
    let lastHeight = await modal.evaluate(el => el.scrollHeight);
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;
    
    console.log('📜 Starting modal scroll...');
    
    while (scrollAttempts < maxScrollAttempts) {
      await modal.evaluate(el => el.scrollTo(0, el.scrollHeight));
      await randomDelay(1000, 2000);
      
      const newHeight = await modal.evaluate(el => el.scrollHeight);
      if (newHeight === lastHeight) {
        console.log('📜 No more content to load');
        break;
      }
      
      lastHeight = newHeight;
      scrollAttempts++;
      console.log(`📜 Scroll attempt ${scrollAttempts}/${maxScrollAttempts}`);
    }
    
  } catch (error) {
    console.error("Error scrolling modal:", error.message);
    throw new Error("Failed to scroll modal: " + error.message);
  }
}

async function scrapeList(page, buttonSelector) {
  try {
    console.log('🖱️ Clicking button to open modal...');
    await page.click(buttonSelector);
    await randomDelay(2000, 3000);
    
    // Wait for modal with multiple selectors
    const modalSelectors = [
      'div[role="dialog"] ul',
      'div[role="dialog"] div[style*="overflow"]',
      'div[role="dialog"] div[style*="height"]',
      'div[role="dialog"] > div > div',
      'div[role="dialog"]'
    ];
    
    let modalSelector = null;
    for (const selector of modalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        modalSelector = selector;
        console.log(`✅ Modal found with selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!modalSelector) {
      throw new Error("Could not find modal after clicking button");
    }
    
    // Wait for content to load
    await randomDelay(2000, 3000);
    
    // Scroll to load all content
    await scrollModal(page, modalSelector);
    
    // Extract usernames
    console.log('🔍 Extracting usernames...');
    const usernames = await page.evaluate(() => {
      const selectors = [
        'div[role="dialog"] ul li span a',
        'div[role="dialog"] ul li a',
        'div[role="dialog"] div[style*="overflow"] li span a',
        'div[role="dialog"] div[style*="overflow"] li a',
        'div[role="dialog"] li span a',
        'div[role="dialog"] li a',
        'div[role="dialog"] a[href*="/"]'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          return Array.from(elements)
            .map(el => {
              const text = el.textContent?.trim();
              const href = el.getAttribute('href');
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
    
    console.log(`✅ Extracted ${usernames.length} usernames`);
    
    // Close modal
    await page.keyboard.press("Escape");
    await randomDelay(1000, 2000);
    
    return usernames;
  } catch (error) {
    console.error("Error scraping list:", error.message);
    throw new Error("Failed to scrape list: " + error.message);
  }
}

async function findFollowersFollowingButtons(page, targetUser) {
  console.log('🔍 Looking for followers/following buttons...');
  
  const followersSelectors = [
    `a[href="/${targetUser}/followers/"]`,
    `a[href*="/followers/"]`,
    'a[href$="/followers/"]',
    'a[href*="followers"]',
    'a[aria-label*="followers" i]',
    'a[title*="followers" i]'
  ];
  
  const followingSelectors = [
    `a[href="/${targetUser}/following/"]`,
    `a[href*="/following/"]`,
    'a[href$="/following/"]',
    'a[href*="following"]',
    'a[aria-label*="following" i]',
    'a[title*="following" i]'
  ];
  
  let followersButton = null;
  let followingButton = null;
  
  for (const selector of followersSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        followersButton = element;
        console.log(`✅ Found followers button: ${selector}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  for (const selector of followingSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        followingButton = element;
        console.log(`✅ Found following button: ${selector}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!followersButton) {
    throw new Error("Could not find followers button");
  }
  if (!followingButton) {
    throw new Error("Could not find following button");
  }
  
  return { followersButton, followingButton };
}

async function scrapeInstagram(targetUser) {
  let browser = null;
  try {
    console.log(`🚀 Starting Playwright scrape for user: ${targetUser}`);
    
    browser = await playwright.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();

    // Login
    await login(page);

    // Navigate to target profile
    console.log(`🌐 Navigating to https://www.instagram.com/${targetUser}/`);
    await page.goto(`https://www.instagram.com/${targetUser}/`, {
      waitUntil: "networkidle",
      timeout: 30000
    });
    
    await randomDelay(2000, 4000);

    // Check if private
    console.log('🔒 Checking if account is private...');
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
      console.log('🔒 Account is private');
      await browser.close();
      return { private: true };
    }

    // Find followers and following buttons
    const { followersButton, followingButton } = await findFollowersFollowingButtons(page, targetUser);

    // Scrape followers and following
    console.log('👥 Scraping followers...');
    const followers = await scrapeList(page, followersButton);
    console.log(`✅ Found ${followers.length} followers`);
    
    console.log('👥 Scraping following...');
    const following = await scrapeList(page, followingButton);
    console.log(`✅ Found ${following.length} following`);

    await browser.close();
    console.log('🎉 Scraping completed successfully');
    return { followers, following, private: false };
    
  } catch (error) {
    console.error("❌ Error in scrapeInstagram:", error.message);
    if (browser) {
      await browser.close();
    }
    throw new Error("Failed to scrape Instagram account: " + error.message);
  }
}

export { scrapeInstagram };
