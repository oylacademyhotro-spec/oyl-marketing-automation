import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import configCluster2 from './configCluster2.js';
import fbPublisher from './fbPublisher.js';
import { mutatePostImage } from './imageMutator.js';

const config = configCluster2;
const CRON_OPTS = { timezone: 'Asia/Ho_Chi_Minh' };

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomJitterMs() {
  const maxMs = config.randomJitterMaxMinutes * 60 * 1000;
  return Math.floor(Math.random() * maxMs);
}

function loadDatabase() {
  if (!fs.existsSync(config.databaseFile)) {
    // Generate initial database from OYL_Career_Coach_Studio.csv
    const csvContent = fs.readFileSync(config.csvSource, 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(',');
    
    // Parse CSV rows
    const posts = [];
    // Regular CSV parse with quotes support
    let currentLine = '';
    let insideQuotes = false;
    let rows = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!insideQuotes) {
        currentLine = line;
      } else {
        currentLine += '\n' + line;
      }

      const quoteCount = (currentLine.match(/"/g) || []).length;
      if (quoteCount % 2 === 0) {
        rows.push(currentLine);
        currentLine = '';
        insideQuotes = false;
      } else {
        insideQuotes = true;
      }
    }

    rows.forEach((r, idx) => {
      // Basic CSV field extractor
      const parts = r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const id = idx + 1;
      posts.push({
        id,
        queue_index: id,
        pillar: parts[1]?.replace(/^"|"$/g, '') || 'KỸ NĂNG & PHƯƠNG PHÁP THAM VẤN',
        subhead: parts[2]?.replace(/^"|"$/g, '') || `Chuyên đề #${id}`,
        quote: parts[3]?.replace(/^"|"$/g, '') || '',
        caption: parts[4]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '',
        imagePath: `./assets/posts_cluster2/post_${id}.png`,
        publishing: {
          page_c: { status: 'pending' },
          page_d: { status: 'pending' }
        }
      });
    });

    fs.writeFileSync(config.databaseFile, JSON.stringify(posts, null, 2), 'utf-8');
    return posts;
  }

  return JSON.parse(fs.readFileSync(config.databaseFile, 'utf-8'));
}

function saveDatabase(posts) {
  fs.writeFileSync(config.databaseFile, JSON.stringify(posts, null, 2), 'utf-8');
}

function getNextPendingPost(posts, pageKey) {
  const pKey = `page_${pageKey.toLowerCase()}`;
  return posts.find(p => (p.publishing?.[pKey]?.status || 'pending') === 'pending') || null;
}

export async function triggerPublishCluster2(pageKey = 'C', shiftLabel = 'Ca Đăng Bài') {
  const now = new Date();
  const pageConfig = pageKey === 'C' ? config.pageC : config.pageD;

  console.log('\n' + '='.repeat(70));
  console.log(`⏰ [CỤM 2 TRIGGER] ${now.toLocaleTimeString('vi-VN')} — ${shiftLabel}`);
  console.log(`📢 Target: ${pageConfig.name} (Page ${pageKey})`);

  const jitterMs = getRandomJitterMs();
  const jitterMinutes = (jitterMs / 60000).toFixed(1);
  console.log(`🎲 Anti-Spam Random Jitter: +${jitterMinutes} phút (${jitterMs}ms)`);

  if (jitterMs > 0 && !config.dryRun) {
    console.log(`⏳ Đang chờ thời gian giãn cách ngẫu nhiên trước khi đăng...`);
    await sleep(jitterMs);
  }

  const posts = loadDatabase();
  const nextPost = getNextPendingPost(posts, pageKey);

  if (!nextPost) {
    console.log(`🎉 Đã đăng hết toàn bộ bài viết trong hàng đợi cho Page ${pageKey}!`);
    return;
  }

  console.log(`📝 Đang chuẩn bị bài #${nextPost.id}:`);
  console.log(`   • Chủ đề : ${nextPost.pillar}`);
  console.log(`   • Tiêu đề: ${nextPost.subhead}`);

  // Caption với CTA và Hashtag chuẩn cho Page C hoặc Page D
  const fullCaption = `${nextPost.quote}\n\n${nextPost.caption}\n\n${pageConfig.cta}\n\n${pageConfig.hashtags}`;

  // Image path: nếu là Page D (Trainer Nguyên Phụng) thì biến tấu nhẹ để khác hash với Page C
  let imgPath = path.resolve(config.rootDir, 'assets', 'posts', `post_${(nextPost.id % 200) + 1}.png`);
  if (!fs.existsSync(imgPath)) {
    imgPath = path.resolve(config.rootDir, 'assets', 'posts', 'post_1.png');
  }

  let finalImgPath = imgPath;
  if (pageKey === 'D') {
    const mutatedPath = path.resolve(config.rootDir, 'assets', 'posts', `post_${nextPost.id}_cluster2_paged.png`);
    await mutatePostImage(imgPath, mutatedPath, { variant: 'page_b' });
    finalImgPath = mutatedPath;
  }

  try {
    const res = await fbPublisher.publishPhoto({
      pageKey: pageKey === 'C' ? 'C' : 'D',
      imagePath: finalImgPath,
      caption: fullCaption,
      customToken: pageConfig.token,
      customPageId: pageConfig.id
    });

    if (res.success) {
      if (!nextPost.publishing) nextPost.publishing = {};
      nextPost.publishing[`page_${pageKey.toLowerCase()}`] = {
        status: 'published',
        published_at: res.publishedAt,
        post_id: res.postId
      };
      saveDatabase(posts);
      console.log(`✅ [THÀNH CÔNG] Đã đăng lên ${pageConfig.name}! Mã bài viết: ${res.postId}`);
    }
  } catch (err) {
    console.error(`❌ [LỖI ĐĂNG BÀI] ${err.message}`);
  }
}

export async function triggerVideoCluster2(targetPageKey = 'C', shiftLabel = 'Ca Video') {
  const pageConfig = targetPageKey === 'C' ? config.pageC : config.pageD;
  console.log('\n' + '='.repeat(70));
  console.log(`🎬 [CỤM 2 VIDEO TRIGGER] ${new Date().toLocaleTimeString('vi-VN')} — ${shiftLabel}`);
  console.log(`📢 Target Fanpage: ${pageConfig.name}`);

  const videoDir = config.videosDir;
  const videoFiles = fs.readdirSync(videoDir).filter(f => f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    console.log('⚠️ Chưa có video trong assets/videos!');
    return;
  }

  const selectedVideo = videoFiles[Math.floor(Math.random() * videoFiles.length)];
  const videoPath = path.join(videoDir, selectedVideo);

  const posts = loadDatabase();
  const samplePost = posts[Math.floor(Math.random() * posts.length)];
  const videoCaption = `🎬 【 VIDEO NGẮN ĐỊNH HƯỚNG NGHỀ NGHIỆP 】\n\n${samplePost.quote}\n\n${samplePost.caption}\n\n${pageConfig.cta}\n\n${pageConfig.hashtags}`;

  try {
    const res = await fbPublisher.publishVideo({
      pageKey: targetPageKey === 'C' ? 'C' : 'D',
      videoPath,
      title: samplePost.subhead,
      description: videoCaption,
      customToken: pageConfig.token,
      customPageId: pageConfig.id
    });

    if (res.success) {
      console.log(`✅ [THÀNH CÔNG] Đã đăng video lên ${pageConfig.name}! Mã video: ${res.videoId}`);
    }
  } catch (err) {
    console.error(`❌ [LỖI VIDEO] ${err.message}`);
  }
}

export function startCluster2Scheduler() {
  console.log('='.repeat(70));
  console.log('🤖 OYL MARKETING AUTOMATION ENGINE — CỤM 2 (HỌC VIỆN & TRAINER NGUYÊN PHỤNG)');
  console.log('='.repeat(70));
  console.log(`🏢 Page C: ${config.pageC.name} [ID: ${config.pageC.id}]`);
  console.log(`🏢 Page D: ${config.pageD.name} [ID: ${config.pageD.id}]`);
  console.log('\n⏰ LỊCH ĐĂNG (MỖI NGÀY 2 BÀI VIẾT + 2 VIDEO REELS):');
  console.log('  • 07:00 AM : 🎬 Ca Video Sáng 1 (Học Viện OYL)');
  console.log('  • 08:00 AM : 🌅 Ca Sáng Bài Viết (Học Viện OYL)');
  console.log('  • 08:45 AM : 🌅 Ca Sáng Bài Viết (Trainer Nguyên Phụng - So le)');
  console.log('  • 18:30 PM : 🎬 Ca Video Tối 2 (Trainer Nguyên Phụng)');
  console.log('  • 19:30 PM : 🌙 Ca Tối Bài Viết (Học Viện OYL)');
  console.log('  • 20:15 PM : 🌙 Ca Tối Bài Viết (Trainer Nguyên Phụng - So le)');
  console.log('='.repeat(70) + '\n');

  // Lịch bài viết Page C
  config.cron.pageCSlots.forEach(slot => {
    cron.schedule(slot.cron, async () => {
      await triggerPublishCluster2('C', slot.label);
    }, CRON_OPTS);
  });

  // Lịch bài viết Page D
  config.cron.pageDSlots.forEach(slot => {
    cron.schedule(slot.cron, async () => {
      await triggerPublishCluster2('D', slot.label);
    }, CRON_OPTS);
  });

  // Lịch video (07:00 & 18:30)
  config.cron.videoSlots.forEach((slot, idx) => {
    cron.schedule(slot.cron, async () => {
      const target = idx === 0 ? 'C' : 'D';
      await triggerVideoCluster2(target, slot.label);
    }, CRON_OPTS);
  });

  console.log('🟢 Cụm 2 đã kích hoạt thành công chạy ngầm 24/7!\n');
}

if (process.argv[2] === 'start') {
  startCluster2Scheduler();
}
