// utils/instagramScraperHybrid.js
// Hybrid approach that tries multiple scraping methods

import { scrapeInstagram as playwrightScrape } from './instagramScraperPlaywright.js';
import { scrapeInstagram as advancedScrape } from './instagramScraperAdvanced.js';

async function scrapeInstagram(targetUser) {
  console.log(`🔄 Starting hybrid scrape for user: ${targetUser}`);
  
  // Try Playwright first (most comprehensive)
  try {
    console.log('🎭 Attempting Playwright scraping...');
    const result = await playwrightScrape(targetUser);
    console.log('✅ Playwright scraping successful');
    return result;
  } catch (error) {
    console.log('❌ Playwright scraping failed:', error.message);
  }
  
  // Try advanced approach as fallback
  try {
    console.log('🚀 Attempting advanced scraping...');
    const result = await advancedScrape(targetUser);
    console.log('✅ Advanced scraping successful');
    return result;
  } catch (error) {
    console.log('❌ Advanced scraping failed:', error.message);
  }
  
  // If both fail, return a helpful error
  throw new Error(
    "All scraping methods failed. Instagram's anti-automation measures are preventing access. " +
    "Please use the private account option with JSON files instead, or try again later."
  );
}

export { scrapeInstagram };
