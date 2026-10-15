import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, 'assets', 'posts_cluster2');

async function scrapeAll() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('='.repeat(70));
  console.log('🎨 OYL CAREER COACH STUDIO — TẢI TOÀN BỘ 260 ẢNH THẺ ĐỒ HỌA CHUẨN');
  console.log('='.repeat(70));
  console.log(`🌐 Nguồn: https://oyl-career-coach-studio.vercel.app/`);
  console.log(`📂 Thư mục đích: ${outDir}\n`);

  console.log('🚀 Đang khởi động Playwright Browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('https://oyl-career-coach-studio.vercel.app/', { waitUntil: 'networkidle', timeout: 90000 });
  // Chờ fonts và các canvas render hoàn tất
  console.log('⏳ Chờ web render toàn bộ thẻ...');
  await page.waitForTimeout(4000);

  // Lấy dữ liệu bài từ trang web
  const webItems = await page.evaluate(() => {
    if (typeof QUOTES_DATA === 'undefined') return [];
    return QUOTES_DATA.map(item => ({
      id: item.id,
      pillar: item.pillar,
      subhead: item.subhead || '',
      quote: item.quote || '',
      caption: item.caption || '',
      hashtag: item.hashtag || ''
    }));
  });

  console.log(`✅ Tìm thấy ${webItems.length} bài viết trên web studio.`);

  // Cập nhật database_cluster2.json với đúng 100% dữ liệu từ web
  const dbPath = path.resolve(rootDir, 'database_cluster2.json');
  let existingDb = [];
  if (fs.existsSync(dbPath)) {
    try {
      existingDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch (e) {}
  }
  const existingMap = new Map(existingDb.map(p => [p.id, p]));

  const updatedDb = webItems.map(item => {
    const existing = existingMap.get(item.id);
    return {
      id: item.id,
      queue_index: item.id,
      pillar: item.pillar,
      subhead: item.subhead,
      quote: item.quote,
      caption: item.caption,
      hashtag: item.hashtag,
      imagePath: `./assets/posts_cluster2/post_${item.id}.png`,
      publishing: existing?.publishing || {
        page_c: { status: 'pending' },
        page_d: { status: 'pending' }
      }
    };
  });
  fs.writeFileSync(dbPath, JSON.stringify(updatedDb, null, 2), 'utf-8');
  console.log(`📁 Đã đồng bộ cơ sở dữ liệu database_cluster2.json (${updatedDb.length} bài).`);

  // Trích xuất ảnh theo từng lô (batch) 20 ảnh để siêu nhanh
  const BATCH_SIZE = 20;
  let totalSaved = 0;

  for (let i = 0; i < webItems.length; i += BATCH_SIZE) {
    const chunk = webItems.slice(i, i + BATCH_SIZE);
    const chunkIds = chunk.map(x => x.id);

    // Lấy dataUrl của chunk
    const batchUrls = await page.evaluate((ids) => {
      const res = {};
      ids.forEach(id => {
        const c = document.getElementById('canvas_' + id);
        if (c) res[id] = c.toDataURL('image/png');
      });
      return res;
    }, chunkIds);

    for (const id of chunkIds) {
      const dataUrl = batchUrls[id];
      if (dataUrl) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const targetFile = path.join(outDir, `post_${id}.png`);
        fs.writeFileSync(targetFile, Buffer.from(base64Data, 'base64'));
        totalSaved++;
      } else {
        console.warn(`⚠️ Không lấy được canvas_${id}`);
      }
    }

    console.log(`📸 Đã tải & lưu xong ${totalSaved}/${webItems.length} ảnh thẻ Career Coach...`);
  }

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log(`🎉 HOÀN TẤT! ĐÃ LƯU ĐỦ ${totalSaved} ẢNH THẺ ĐỒ HỌA CAREER COACH VÀO assets/posts_cluster2/`);
  console.log('='.repeat(70));
}

scrapeAll().catch(err => {
  console.error('❌ Lỗi khi scrape:', err);
  process.exit(1);
});
