// utils/instagramScraperStealth.js
import dotenv from "dotenv";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

dotenv.config();

// Add stealth plugin
puppeteer.use(StealthPlugin());

const IG_USER = process.env.IG_USER;
const IG_PASS = process.env.IG_PASS;

if (!IG_USER || !IG_PASS) {
  throw new Error("IG_USER and IG_PASS environment variables required");
}

async function login(page) {
  try {
    console.log('Logging in with stealth mode...');
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
    });

    // Wait for login form
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.waitForSelector('input[name="password"]', { timeout: 15000 });

    // Clear and type credentials
    await page.click('input[name="username"]', { clickCount: 3 });
    await page.type('input[name="username"]', IG_USER, { delay: 100 });
    
    await page.click('input[name="password"]', { clickCount: 3 });
    await page.type('input[name="password"]', IG_PASS, { delay: 100 });

    // Wait before submitting
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Submit form
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);

    // Verify login success
    await page.waitForSelector('a[href="/"]', { timeout: 15000 });
    console.log('Login successful');
    
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
    const maxScrollAttempts = 50;
    
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
    console.log('Clicking button to open modal...');
    await page.click(buttonSelector);
    
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
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!modalSelector) {
      throw new Error("Could not find modal after clicking button");
    }
    
    console.log('Modal found, scrolling to load content...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await scrollModal(page, modalSelector);
    
    // Extract usernames
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
    console.log(`Starting stealth scrape for user: ${targetUser}`);
    browser = await puppeteer.launch({ 
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
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Login
    await login(page);

    // Navigate to target profile
    console.log(`Navigating to https://www.instagram.com/${targetUser}/`);
    await page.goto(`https://www.instagram.com/${targetUser}/`, {
      waitUntil: "networkidle2",
    });

    // Check if private
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

    // Find followers and following buttons
    console.log('Looking for followers/following buttons...');
    const { followersButton, followingButton } = await findFollowersFollowingButtons(page, targetUser);

    // Scrape followers and following
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
    if (browser) {
      await browser.close();
    }
    throw new Error("Failed to scrape Instagram account: " + error.message);
  }
}

export { scrapeInstagram };
