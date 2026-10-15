import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { buildRoundRobinQueue, validateQueueConstraints } from './roundRobin.js';
import { mutateImageForPageB } from './imageMutator.js';

/**
 * PLAYWRIGHT SCRAPER & INCREMENTAL SYNC ENGINE
 * - Full scrape: downloads all 210 posts + 1080x1080 Quote Cards with OYL logo.
 * - Incremental Sync: compares web posts with database.json, downloads ONLY new items.
 * - Auto-generates Page B mutated images on download.
 */

export async function runScraper({ forceFull = false } = {}) {
  console.log('='.repeat(70));
  console.log(forceFull ? '🚀 STARTING FULL SCRAPE (ALL 210 POSTS)...' : '🔄 STARTING INCREMENTAL SYNC (07:30 AM TASK)...');
  console.log(`🌐 Target Website: ${config.targetUrl}`);
  console.log('='.repeat(70));

  // Ensure assets directory exists
  if (!fs.existsSync(config.assetsDir)) {
    fs.mkdirSync(config.assetsDir, { recursive: true });
  }

  // Load existing database if available
  let existingPosts = [];
  const existingMap = new Map();
  if (fs.existsSync(config.databasePath)) {
    try {
      const raw = fs.readFileSync(config.databasePath, 'utf-8');
      existingPosts = JSON.parse(raw);
      existingPosts.forEach(p => existingMap.set(p.id, p));
      console.log(`📂 Found existing database with ${existingPosts.length} posts.`);
    } catch (e) {
      console.warn('⚠️ Could not parse existing database.json, creating a fresh one.');
    }
  }

  console.log('🖥️ Launching headless Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  try {
    console.log(`🌐 Navigating to ${config.targetUrl}...`);
    await page.goto(config.targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
    
    // Wait for fonts and canvas initialization
    await page.waitForTimeout(2500);

    // Extract QUOTES_DATA directly from page
    const webData = await page.evaluate(() => {
      if (typeof QUOTES_DATA === 'undefined') return null;
      return QUOTES_DATA.map(item => ({
        id: item.id,
        pillar: item.pillar,
        subhead: item.subhead || '',
        quote: item.quote || '',
        caption: item.caption || '',
        hashtag: item.hashtag || ''
      }));
    });

    if (!webData || webData.length === 0) {
      throw new Error('QUOTES_DATA not found or empty on target website!');
    }

    console.log(`✅ Detected ${webData.length} total posts on target website.`);

    // Determine which posts need to be scraped
    const postsToScrape = [];
    for (const item of webData) {
      const existing = existingMap.get(item.id);
      const imgPath = path.join(config.assetsDir, `post_${item.id}.png`);
      const imgExists = fs.existsSync(imgPath);

      if (forceFull || !existing || !imgExists) {
        postsToScrape.push(item);
      }
    }

    if (postsToScrape.length === 0) {
      console.log('✨ [INCREMENTAL SYNC] Database is already 100% UP TO DATE!');
      console.log(`📊 All ${webData.length} posts and Quote Card images exist locally.`);
      await browser.close();
      return {
        updated: false,
        total: webData.length,
        newCount: 0
      };
    }

    console.log(`📥 Need to scrape & render ${postsToScrape.length} posts...`);

    // Process posts: capture canvas screenshot + save image
    let processed = 0;
    for (const item of postsToScrape) {
      const imgPath = path.join(config.assetsDir, `post_${item.id}.png`);
      const relativeImgPath = `./assets/posts/post_${item.id}.png`;
      const relativeMutatedPath = `./assets/posts/post_${item.id}_page_b.png`;

      // Extract canvas data URL
      const dataUrl = await page.evaluate((id) => {
        const canvas = document.getElementById('canvas_' + id);
        return canvas ? canvas.toDataURL('image/png') : null;
      }, item.id);

      if (!dataUrl) {
        console.warn(`⚠️ Canvas for post_${item.id} not found in DOM, skipping.`);
        continue;
      }

      // Save original high-res image
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(imgPath, Buffer.from(base64Data, 'base64'));

      // Generate Page B mutated image immediately
      try {
        await mutateImageForPageB(imgPath);
      } catch (err) {
        console.warn(`⚠️ Warning: Failed to mutate image for post_${item.id}: ${err.message}`);
      }

      // Preserve existing publishing state if updating
      const existing = existingMap.get(item.id);
      const postRecord = {
        id: item.id,
        pillar: item.pillar,
        subhead: item.subhead,
        quote: item.quote,
        caption: item.caption,
        hashtag: item.hashtag,
        image_path: relativeImgPath,
        mutated_image_path: relativeMutatedPath,
        created_at: existing?.created_at || new Date().toISOString(),
        publishing: existing?.publishing || {
          page_a: { status: 'pending', published_at: null, post_id: null },
          page_b: { status: 'pending', published_at: null, post_id: null }
        }
      };

      existingMap.set(item.id, postRecord);
      processed++;

      if (processed % 25 === 0 || processed === postsToScrape.length) {
        console.log(`  📸 Rendered & saved Quote Card images: ${processed}/${postsToScrape.length}`);
      }
    }

    console.log('🔄 Rebuilding Round-Robin Interleaved Schedule...');
    const allPosts = Array.from(existingMap.values());
    const queuedPosts = buildRoundRobinQueue(allPosts);

    // Validate constraint: no 2 identical topics adjacent
    const validation = validateQueueConstraints(queuedPosts);
    if (!validation.valid) {
      console.warn(`⚠️ Notice: Found ${validation.violationCount} consecutive topic pairings (due to topic size disparity).`);
    } else {
      console.log('✅ Schedule Validation Passed: 0 adjacent topic collisions!');
    }

    // Save to database.json
    fs.writeFileSync(config.databasePath, JSON.stringify(queuedPosts, null, 2), 'utf-8');
    console.log(`💾 Saved ${queuedPosts.length} posts to ${config.databasePath}`);

    // Print summary table by topic
    const topicSummary = {};
    for (const p of queuedPosts) {
      topicSummary[p.pillar] = (topicSummary[p.pillar] || 0) + 1;
    }
    console.log('\n📊 TOPIC BREAKDOWN:');
    for (const [t, c] of Object.entries(topicSummary)) {
      console.log(`  • ${t.padEnd(38)}: ${c} posts`);
    }
    console.log(`  👉 TOTAL CONTENT DAYS (3 posts/day): ${(queuedPosts.length / 3).toFixed(1)} days\n`);

    await browser.close();
    return {
      updated: true,
      total: queuedPosts.length,
      newCount: processed
    };
  } catch (err) {
    await browser.close();
    console.error('❌ Scraper error:', err);
    throw err;
  }
}

// CLI direct run support
if (process.argv[1] && process.argv[1].endsWith('scraper.js')) {
  const isSync = process.argv.includes('--sync');
  runScraper({ forceFull: !isSync }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
