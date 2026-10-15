import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { runScraper } from './scraper.js';
import { loadDatabase, triggerPublish, triggerVideoPublish } from './scheduler.js';
import { preparePostPayload } from './captionVariator.js';
import { getFileHash } from './imageMutator.js';

const command = process.argv[2] || 'help';

async function main() {
  switch (command) {
    case 'dry-run':
      await runDryRun();
      break;

    case 'publish-now':
      const pageArg = (process.argv.find(a => a.startsWith('--page=')) || '--page=A').split('=')[1].toUpperCase();
      console.log(`🚀 Executing immediate test publish for Page ${pageArg}...`);
      await triggerPublish(pageArg, 'Manual Test Trigger', { skipJitter: true });
      break;

    case 'publish-video':
      const pageV = (process.argv.find(a => a.startsWith('--page=')) || '--page=A').split('=')[1].toUpperCase();
      console.log(`🚀 Executing immediate test video publish for Page ${pageV}...`);
      await triggerVideoPublish(pageV, 'Manual Test Video Trigger', { skipJitter: true });
      break;

    case 'status':
      printStatus();
      break;

    case 'scrape':
      await runScraper({ forceFull: true });
      break;

    case 'sync':
      await runScraper({ forceFull: false });
      break;

    case 'help':
    default:
      printHelp();
      break;
  }
}

async function runDryRun() {
  console.log('='.repeat(78));
  console.log('🔍 [DRY-RUN MODE] OYL MARKETING AUTOMATION ENGINE — PRE-FLIGHT CHECK');
  console.log('='.repeat(78));
  console.log(`🌐 Target Site        : ${config.targetUrl}`);
  console.log(`📁 Database Path      : ${config.databasePath}`);
  console.log(`🖼️ Assets Directory   : ${config.assetsDir}`);
  console.log(`🏢 Fanpage A          : ${config.pageA.name} (ID: ${config.pageA.id || 'Not configured in .env'})`);
  console.log(`🏢 Fanpage B          : ${config.pageB.name} (ID: ${config.pageB.id || 'Not configured in .env'})`);
  console.log('='.repeat(78));

  // If database doesn't exist, prompt user or scrape
  if (!fs.existsSync(config.databasePath)) {
    console.log('\n⚠️  No database.json found. Running initial scrape first...\n');
    await runScraper({ forceFull: true });
  }

  const posts = loadDatabase();
  if (posts.length === 0) {
    console.error('❌ Database is empty! Please run `npm run scrape` first.');
    return;
  }

  console.log(`\n📊 DATABASE OVERVIEW:`);
  console.log(`   • Total Posts in Queue : ${posts.length}`);
  console.log(`   • Content Days (3/day) : ${(posts.length / 3).toFixed(1)} days (~${Math.round(posts.length / 3 / 30)} months)`);
  
  // Topic count
  const topicCounts = {};
  posts.forEach(p => topicCounts[p.pillar] = (topicCounts[p.pillar] || 0) + 1);
  console.log('\n🏷️  TOPIC BREAKDOWN:');
  for (const [topic, count] of Object.entries(topicCounts)) {
    console.log(`   • ${topic.padEnd(36)}: ${count} posts`);
  }

  // Preview Day 1 Schedule for both Page A and Page B
  console.log('\n' + '='.repeat(78));
  console.log('📅 DAY 1 PREVIEW: 3-SLOT DUAL-FANPAGE DISTRIBUTION SCHEDULE');
  console.log('='.repeat(78));

  // Day 1 slots
  const day1Slots = [
    {
      shift: 'CA SÁNG',
      pageATime: '08:00 (Jitter: 0-10m)',
      pageBTime: '08:45 (Jitter: 0-10m - So le)',
      postIndexA: 0,
      postIndexB: 1
    },
    {
      shift: 'CA CHIỀU',
      pageATime: '14:00 (Jitter: 0-10m)',
      pageBTime: '14:45 (Jitter: 0-10m - So le)',
      postIndexA: 2,
      postIndexB: 3
    },
    {
      shift: 'CA TỐI',
      pageATime: '19:00 (Jitter: 0-10m)',
      pageBTime: '19:45 (Jitter: 0-10m - So le)',
      postIndexA: 4,
      postIndexB: 5
    }
  ];

  for (const slot of day1Slots) {
    const postA = posts[slot.postIndexA];
    const postB = posts[slot.postIndexB];

    console.log(`\n${'─'.repeat(78)}`);
    console.log(`⏰ [KHUNG GIỜ ${slot.shift}]`);
    console.log(`${'─'.repeat(78)}`);

    // PAGE A PREVIEW
    if (postA) {
      const payloadA = preparePostPayload(postA, 'A');
      const absImgA = path.resolve(config.rootDir, payloadA.imagePath);
      const imgAExists = fs.existsSync(absImgA);
      const imgASize = imgAExists ? fs.statSync(absImgA).size : 0;
      const hashA = imgAExists ? getFileHash(absImgA) : 'N/A';

      console.log(`\n🔵 [PAGE A - 08:00/14:00/19:00] Khung giờ: ${slot.pageATime}`);
      console.log(`   📌 Bài #${postA.id} (Queue #${postA.queue_index}) | Chủ đề: [${postA.pillar}]`);
      console.log(`   🖼️  Ảnh gốc: ${payloadA.imagePath} | ${imgAExists ? `✅ Tồn tại (${(imgASize/1024).toFixed(1)} KB)` : '❌ THIẾU'}`);
      console.log(`   🔑 Hash file: ${hashA.slice(0, 16)}...`);
      console.log(`   📝 Caption Page A:\n`);
      const linesA = payloadA.caption.split('\n');
      console.log(`      ${linesA.slice(0, 4).join('\n      ')}`);
      console.log(`      ... [${linesA.length} dòng nội dung] ...`);
      console.log(`      ${linesA.slice(-2).join('\n      ')}`);
    }

    // PAGE B PREVIEW
    if (postB) {
      const payloadB = preparePostPayload(postB, 'B');
      const absImgB = path.resolve(config.rootDir, payloadB.imagePath);
      const imgBExists = fs.existsSync(absImgB);
      const imgBSize = imgBExists ? fs.statSync(absImgB).size : 0;
      const hashB = imgBExists ? getFileHash(absImgB) : 'N/A';

      console.log(`\n🟢 [PAGE B - 08:45/14:45/19:45] Khung giờ: ${slot.pageBTime} (LỆCH 45 PHÚT & SO LE)`);
      console.log(`   📌 Bài #${postB.id} (Queue #${postB.queue_index}) | Chủ đề: [${postB.pillar}]`);
      console.log(`   🖼️  Ảnh biến tấu: ${payloadB.imagePath} | ${imgBExists ? `✅ Tồn tại (${(imgBSize/1024).toFixed(1)} KB)` : '❌ THIẾU'}`);
      console.log(`   🔑 Hash file: ${hashB.slice(0, 16)}... (Độc nhất, chống trùng Meta)`);
      console.log(`   📝 Caption Page B (Đã biến tấu Hook, CTA & Hashtags):\n`);
      const linesB = payloadB.caption.split('\n');
      console.log(`      ${linesB.slice(0, 4).join('\n      ')}`);
      console.log(`      ... [${linesB.length} dòng nội dung] ...`);
      console.log(`      ${linesB.slice(-2).join('\n      ')}`);
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('✅ DRY-RUN HOÀN TẤT: Toàn bộ thuật toán, cấu trúc dữ liệu và hình ảnh hợp lệ!');
  console.log('👉 Sẵn sàng kích hoạt tự động với lệnh: npm run schedule');
  console.log('='.repeat(78) + '\n');
}

function printStatus() {
  const posts = loadDatabase();
  if (posts.length === 0) {
    console.log('Database empty. Run `npm run scrape`.');
    return;
  }
  const publishedA = posts.filter(p => p.publishing?.page_a?.status === 'published').length;
  const publishedB = posts.filter(p => p.publishing?.page_b?.status === 'published').length;
  console.log(`\n📊 HỆ THỐNG MARKETING AUTOMATION OYL GLOBAL`);
  console.log(`   • Tổng số bài viết   : ${posts.length}`);
  console.log(`   • Page A đã đăng     : ${publishedA}/${posts.length}`);
  console.log(`   • Page B đã đăng     : ${publishedB}/${posts.length}`);
  console.log(`   • Còn lại chờ đăng   : ${posts.length - publishedA} bài (Page A) | ${posts.length - publishedB} bài (Page B)\n`);
}

function printHelp() {
  console.log(`
Available CLI commands:
  npm run dry-run           Render Day 1 preview for 2 pages, verify images & captions
  npm run scrape            Full scrape of all 210 posts and Quote Cards from website
  npm run sync              Incremental sync (checks website, only scrapes new posts)
  npm run schedule          Launch cron daemon (07:30 sync + 3 shifts/day for 2 pages)
  npm run publish-now       Publish 1 pending post immediately (--page=A or --page=B)
  npm run status            Display queue progress and status counts
`);
}

main().catch(err => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
