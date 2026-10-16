import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import configCluster2 from './configCluster2.js';
import fbPublisher from './fbPublisher.js';
import { mutateImageForPageB } from './imageMutator.js';

const config = configCluster2;
const CRON_OPTS = { timezone: 'Asia/Ho_Chi_Minh' };

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomJitterMs() {
  const maxMs = config.randomJitterMaxMinutes * 60 * 1000;
  return Math.floor(Math.random() * maxMs);
}

function parseCSV(text) {
  const p = [];
  let row = [''];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        row[row.length - 1] += '"';
        i += 2;
        continue;
      } else if (c === '"') {
        inQuotes = false;
        i++;
        continue;
      } else {
        row[row.length - 1] += c;
        i++;
        continue;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (c === ',') {
        row.push('');
        i++;
        continue;
      } else if (c === '\r') {
        i++;
        continue;
      } else if (c === '\n') {
        p.push(row);
        row = [''];
        i++;
        continue;
      } else {
        row[row.length - 1] += c;
        i++;
        continue;
      }
    }
  }
  if (row.length > 1 || row[0] !== '') {
    p.push(row);
  }
  return p;
}

function loadDatabase() {
  if (!fs.existsSync(config.databaseFile)) {
    const csvContent = fs.readFileSync(config.csvSource, 'utf-8');
    const rawRows = parseCSV(csvContent);
    const rows = rawRows.slice(1);
    const posts = rows.map((cols, idx) => {
      const id = parseInt(cols[0], 10) || (idx + 1);
      return {
        id,
        queue_index: id,
        pillar: cols[1] || 'KỸ NĂNG & PHƯƠNG PHÁP THAM VẤN',
        subhead: cols[2] || `Chuyên đề #${id}`,
        quote: cols[3] || '',
        caption: cols[4] || '',
        imagePath: `./assets/posts/post_${((id - 1) % 200) + 1}.png`,
        publishing: {
          page_c: { status: 'pending' },
          page_d: { status: 'pending' }
        }
      };
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

export async function triggerPublishCluster2(pageKey = 'C', shiftLabel = 'Ca Đăng Bài', options = {}) {
  const now = new Date();
  const pageConfig = pageKey === 'C' ? config.pageC : config.pageD;

  console.log('\n' + '='.repeat(70));
  console.log(`⏰ [CỤM 2 TRIGGER] ${now.toLocaleTimeString('vi-VN')} — ${shiftLabel}`);
  console.log(`📢 Target: ${pageConfig.name} (Page ${pageKey})`);

  if (!options.skipJitter) {
    const jitterMs = getRandomJitterMs();
    const jitterMinutes = (jitterMs / 60000).toFixed(1);
    console.log(`🎲 Anti-Spam Random Jitter: +${jitterMinutes} phút (${jitterMs}ms)`);

    if (jitterMs > 0 && !config.dryRun) {
      console.log(`⏳ Đang chờ thời gian giãn cách ngẫu nhiên trước khi đăng...`);
      await sleep(jitterMs);
    }
  } else {
    console.log(`⚡ [SKIP JITTER] Chế độ đăng trực tiếp ngay lập tức.`);
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

  // Image path: lấy từ thư mục posts_cluster2 được cào chuẩn từ oyl-career-coach-studio
  let imgPath = path.resolve(config.rootDir, 'assets', 'posts_cluster2', `post_${nextPost.id}.png`);
  if (!fs.existsSync(imgPath)) {
    imgPath = path.resolve(config.rootDir, 'assets', 'posts_cluster2', 'post_1.png');
  }

  let finalImgPath = imgPath;
  if (pageKey === 'D') {
    const mutated = await mutateImageForPageB(imgPath);
    finalImgPath = mutated.mutatedPath;
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

  const videoCaption = `${samplePost.quote}\n\n${samplePost.caption}\n\n${pageConfig.cta}\n\n${pageConfig.hashtags}`;

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
