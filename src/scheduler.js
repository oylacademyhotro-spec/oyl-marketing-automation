import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { runScraper } from './scraper.js';
import { fbPublisher } from './fbPublisher.js';
import { preparePostPayload } from './captionVariator.js';

/**
 * MARKETING AUTOMATION SCHEDULER ENGINE
 * 
 * Timetable:
 * - 07:30 AM: Incremental Sync from https://oyl-viral-studio.vercel.app/
 * - 08:00 AM (jitter 0-10m): Page A Morning Shift
 * - 08:45 AM (jitter 0-10m): Page B Morning Shift (Staggered)
 * - 14:00 PM (jitter 0-10m): Page A Afternoon Shift
 * - 14:45 PM (jitter 0-10m): Page B Afternoon Shift (Staggered)
 * - 19:00 PM (jitter 0-10m): Page A Evening Shift
 * - 19:45 PM (jitter 0-10m): Page B Evening Shift (Staggered)
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomJitterMs() {
  const maxMinutes = Number.isFinite(config.randomJitterMaxMinutes) ? config.randomJitterMaxMinutes : 10;
  const jitterMs = Math.floor(Math.random() * maxMinutes * 60 * 1000);
  return jitterMs;
}

export function loadDatabase() {
  if (!fs.existsSync(config.databasePath)) {
    return [];
  }
  const raw = fs.readFileSync(config.databasePath, 'utf-8');
  return JSON.parse(raw);
}

export function saveDatabase(posts) {
  fs.writeFileSync(config.databasePath, JSON.stringify(posts, null, 2), 'utf-8');
}

/**
 * Finds the next pending post for the specified page
 * Ensures Page A and Page B do not publish the exact same post on the same day!
 */
export function getNextPendingPost(posts, targetPage = 'A') {
  const pageKey = targetPage.toLowerCase();
  const otherPageKey = pageKey === 'a' ? 'b' : 'a';

  // Find today's published post IDs on the other page
  const todayStr = new Date().toISOString().slice(0, 10);
  const otherPagePublishedToday = new Set(
    posts
      .filter(p => {
        const pub = p.publishing?.[`page_${otherPageKey}`];
        return pub?.status === 'published' && pub.published_at?.startsWith(todayStr);
      })
      .map(p => p.id)
  );

  for (const post of posts) {
    const pubStatus = post.publishing?.[`page_${pageKey}`]?.status || 'pending';
    if (pubStatus === 'pending') {
      // Avoid publishing the same post if other page published it today
      if (!otherPagePublishedToday.has(post.id)) {
        return post;
      }
    }
  }

  // Fallback: any pending post for this page
  return posts.find(p => (p.publishing?.[`page_${pageKey}`]?.status || 'pending') === 'pending') || null;
}

/**
 * Executes a single scheduled publication for Page A or Page B
 */
export async function triggerPublish(pageKey = 'A', shiftLabel = 'Scheduled Shift', options = {}) {
  const now = new Date();
  const pageConfig = pageKey === 'A' ? config.pageA : config.pageB;
  
  console.log('\n' + '-'.repeat(70));
  console.log(`⏰ [TRIGGER] ${now.toLocaleTimeString('vi-VN')} — ${shiftLabel}`);
  console.log(`📢 Target: ${pageConfig.name} (Page ${pageKey})`);
  
  // Calculate and apply random jitter (0 - 10 minutes) unless skipJitter is true
  const jitterMs = options.skipJitter ? 0 : getRandomJitterMs();
  const jitterMinutes = (jitterMs / 60000).toFixed(1);
  if (options.skipJitter) {
    console.log(`⚡ Anti-Spam Jitter skipped for manual immediate trigger.`);
  } else {
    console.log(`🎲 Anti-Spam Random Jitter: +${jitterMinutes} minutes (${jitterMs}ms)`);
  }
  
  if (jitterMs > 0 && !config.dryRun) {
    console.log(`⏳ Waiting for jitter delay before publishing...`);
    await sleep(jitterMs);
  }

  const posts = loadDatabase();
  if (posts.length === 0) {
    console.error('❌ Database is empty! Please run `npm run scrape` first.');
    return;
  }

  const nextPost = getNextPendingPost(posts, pageKey);
  if (!nextPost) {
    console.log(`🎉 All posts have been published for Page ${pageKey}! Queue is complete.`);
    return;
  }

  const payload = preparePostPayload(nextPost, pageKey);
  const absoluteImgPath = path.resolve(config.rootDir, payload.imagePath);

  console.log(`📝 Selected Post #${nextPost.id} (Queue #${nextPost.queue_index}):`);
  console.log(`   • Topic : ${nextPost.pillar}`);
  console.log(`   • Quote : "${nextPost.quote.substring(0, 70)}..."`);
  console.log(`   • Image : ${payload.imagePath}`);

  try {
    const result = await fbPublisher.publishPhoto({
      pageKey,
      imagePath: absoluteImgPath,
      caption: payload.caption
    });

    if (result.success) {
      // Update database status
      if (!nextPost.publishing) nextPost.publishing = {};
      nextPost.publishing[`page_${pageKey.toLowerCase()}`] = {
        status: 'published',
        published_at: result.publishedAt,
        post_id: result.postId,
        photo_id: result.photoId
      };

      saveDatabase(posts);

      console.log(`✅ [SUCCESS] Published to ${pageConfig.name}!`);
      console.log(`   • Post ID   : ${result.postId}`);
      console.log(`   • Mode      : ${result.dryRun ? 'DRY-RUN (Simulated)' : 'LIVE FACEBOOK GRAPH API'}`);
      console.log(`   • Timestamp : ${result.publishedAt}`);
    }
  } catch (err) {
    console.error(`❌ [FAILED] Publication error for Page ${pageKey}: ${err.message}`);
    // Mark failure in record
    if (!nextPost.publishing) nextPost.publishing = {};
    nextPost.publishing[`page_${pageKey.toLowerCase()}`] = {
      status: 'failed',
      last_error: err.message,
      attempted_at: new Date().toISOString()
    };
    saveDatabase(posts);
  }
  console.log('-'.repeat(70) + '\n');
}

/**
 * Executes a scheduled video publication (Reels / Shorts)
 * Implements intelligent topic-shuffling so video and photo posts never duplicate topics on the same day!
 */
export async function triggerVideoPublish(pageKey = 'A', shiftLabel = 'Scheduled Video Shift', options = {}) {
  const now = new Date();
  const pageConfig = pageKey === 'A' ? config.pageA : config.pageB;
  
  console.log('\n' + '='.repeat(70));
  console.log(`🎬 [VIDEO TRIGGER] ${now.toLocaleTimeString('vi-VN')} — ${shiftLabel}`);
  console.log(`📢 Target Fanpage : ${pageConfig.name} (Page ${pageKey})`);
  
  const jitterMs = options.skipJitter ? 0 : getRandomJitterMs();
  if (options.skipJitter) {
    console.log(`⚡ Anti-Spam Jitter skipped for manual immediate video trigger.`);
  } else {
    console.log(`🎲 Anti-Spam Random Jitter: +${(jitterMs / 60000).toFixed(1)} minutes`);
  }
  
  if (jitterMs > 0 && !config.dryRun) {
    console.log(`⏳ Waiting for jitter delay before publishing video...`);
    await sleep(jitterMs);
  }

  const posts = loadDatabase();
  const videoDir = path.join(config.rootDir, 'assets', 'videos');
  const videoFiles = fs.existsSync(videoDir) 
    ? fs.readdirSync(videoDir).filter(f => f.endsWith('.mp4'))
    : [];

  if (videoFiles.length === 0) {
    console.warn('⚠️ Không tìm thấy file video MP4 nào trong assets/videos!');
    return;
  }

  // TRÁO ĐỔI LỘN XỘN (CONTENT SHUFFLE & ANTI-OVERLAP):
  // Tìm chủ đề bài viết ảnh đã đăng hôm nay trên Page này
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPhotoTopics = new Set(
    posts
      .filter(p => p.publishing?.[`page_${pageKey.toLowerCase()}`]?.published_at?.startsWith(todayStr))
      .map(p => p.pillar)
  );

  // Chọn video có chủ đề KHÁC với chủ đề bài viết hôm nay (hoặc shuffle ngẫu nhiên)
  const candidateVideos = videoFiles.filter(vf => {
    const match = vf.match(/post_(\d+)/);
    if (!match) return true;
    const post = posts.find(p => p.id === parseInt(match[1]));
    return post ? !todayPhotoTopics.has(post.pillar) : true;
  });

  const pool = candidateVideos.length > 0 ? candidateVideos : videoFiles;
  const selectedVideoFile = pool[Math.floor(Math.random() * pool.length)];
  const videoPath = path.join(videoDir, selectedVideoFile);

  const match = selectedVideoFile.match(/post_(\d+)/);
  const matchedPost = match ? posts.find(p => p.id === parseInt(match[1])) : posts[0];

  const payload = preparePostPayload(matchedPost || posts[0], pageKey);
  const videoCaption = `🎬 【 VIDEO NGẮN ĐỊNH HƯỚNG 】\n\n${payload.caption}`;

  console.log(`🎥 Uploading Video : ${selectedVideoFile}`);
  console.log(`   • Tiêu đề : ${matchedPost?.subhead || 'Định hướng OYL Global'}`);
  console.log(`   • Chủ đề  : ${matchedPost?.pillar || 'Định Hướng Tương Lai'} (Đã tráo đổi so le với bài viết)`);

  try {
    const result = await fbPublisher.publishVideo({
      pageKey,
      videoPath,
      title: matchedPost?.subhead || 'OYL Global Video',
      description: videoCaption
    });

    if (result.success) {
      console.log(`✅ [VIDEO SUCCESS] Published video to ${pageConfig.name}!`);
      console.log(`   • Video ID  : ${result.videoId}`);
      console.log(`   • Post ID   : ${result.postId}`);
      console.log(`   • Timestamp : ${result.publishedAt}`);
    }
  } catch (err) {
    console.error(`❌ [VIDEO FAILED] Error publishing video: ${err.message}`);
  }
  console.log('='.repeat(70) + '\n');
}

/**
 * Initializes all cron jobs
 */
export function startSchedulerDaemon() {
  console.log('='.repeat(70));
  console.log('🤖 OYL MARKETING AUTOMATION ENGINE — SCHEDULER ACTIVE');
  console.log('='.repeat(70));
  console.log(`📅 Current System Time : ${new Date().toLocaleString('vi-VN')}`);
  console.log(`⚡ Mode                : ${config.dryRun ? 'DRY-RUN (Zero-Risk Simulation)' : 'LIVE PRODUCTION'}`);
  console.log(`🏢 Page A (Chính)      : ${config.pageA.name} [ID: ${config.pageA.id || 'Not Set'}]`);
  console.log(`🏢 Page B (Vệ Tinh)    : ${config.pageB.name} [ID: ${config.pageB.id || 'Not Set'}]`);
  console.log(`🎲 Random Jitter Max   : ${config.randomJitterMaxMinutes} minutes`);
  console.log('\n⏰ ACTIVE CRON TIMETABLE:');
  console.log('  • 07:00 AM : 🎬 Video Reels/Shorts Shift 1 (So le chủ đề)');
  console.log('  • 07:30 AM : 🔄 Daily Incremental Sync Task');
  console.log('  • 08:00 AM : 🌅 Page A Morning Shift (08:00 + Jitter)');
  console.log('  • 08:45 AM : 🌅 Page B Morning Shift (08:45 + Jitter - Staggered)');
  console.log('  • 14:00 PM : ☀️ Page A Afternoon Shift (14:00 + Jitter)');
  console.log('  • 14:45 PM : ☀️ Page B Afternoon Shift (14:45 + Jitter - Staggered)');
  console.log('  • 15:00 PM : 🎬 Video Reels/Shorts Shift 2 (So le chủ đề)');
  console.log('  • 19:00 PM : 🌙 Page A Evening Shift (19:00 + Jitter)');
  console.log('  • 19:30 PM : 🎬 Video Reels/Shorts Shift 3 (So le chủ đề)');
  console.log('  • 19:45 PM : 🌙 Page B Evening Shift (19:45 + Jitter - Staggered)');
  console.log('='.repeat(70) + '\n');

  const CRON_OPTS = { timezone: 'Asia/Ho_Chi_Minh' };

  // 1. Cron 07:30 AM: Daily Incremental Sync
  cron.schedule(config.cron.syncCheck, async () => {
    console.log(`\n🔔 [CRON 07:30 AM] Running Daily Incremental Sync Task...`);
    try {
      await runScraper({ forceFull: false });
    } catch (e) {
      console.error('❌ Daily sync task failed:', e.message);
    }
  }, CRON_OPTS);

  // 2. Cron for Page A (08:00, 14:00, 19:00)
  config.cron.pageASlots.forEach(slot => {
    cron.schedule(slot.cron, async () => {
      await triggerPublish('A', slot.label);
    }, CRON_OPTS);
  });

  // 3. Cron for Page B (08:45, 14:45, 19:45)
  config.cron.pageBSlots.forEach(slot => {
    cron.schedule(slot.cron, async () => {
      await triggerPublish('B', slot.label);
    }, CRON_OPTS);
  });

  // 4. Cron for Video Reels (07:00, 15:00, 19:30) - Shuffled & Staggered
  if (config.cron.videoSlots) {
    config.cron.videoSlots.forEach((slot, idx) => {
      cron.schedule(slot.cron, async () => {
        // Luân phiên: Ca 1 -> Page A, Ca 2 -> Page B, Ca 3 -> Page A
        const targetPage = idx % 2 === 0 ? 'A' : 'B';
        await triggerVideoPublish(targetPage, slot.label);
      }, CRON_OPTS);
    });
  }

  console.log('🟢 Cron daemon is running in background. Press Ctrl+C to exit.\n');

  // Lightweight HTTP healthcheck server for Cloud Providers (Render, Railway, Fly.io, etc.)
  const PORT = process.env.PORT;
  if (PORT) {
    import('http').then(({ default: http }) => {
      http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'online',
          service: 'OYL Marketing Automation Daemon',
          timestamp: new Date().toISOString()
        }));
      }).listen(PORT, () => {
        console.log(`🌐 Cloud healthcheck HTTP server listening on port ${PORT}`);
      });
    }).catch(err => {
      console.warn('⚠️ Could not start HTTP healthcheck server:', err.message);
    });
  }
}

export { startSchedulerDaemon as startScheduler };

// Direct run
if (process.argv[1] && process.argv[1].endsWith('scheduler.js')) {
  startSchedulerDaemon();
}
