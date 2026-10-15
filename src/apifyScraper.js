import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

/**
 * Token Pool Manager: Automatically rotates across multiple Apify API tokens
 */
export class ApifyTokenPool {
  constructor(tokens = []) {
    this.tokens = tokens.length > 0 
      ? tokens 
      : (process.env.APIFY_TOKENS || '').split(',').map(t => t.trim()).filter(Boolean);
    this.currentIndex = 0;
  }

  addToken(token) {
    if (token && !this.tokens.includes(token.trim())) {
      this.tokens.push(token.trim());
    }
  }

  async checkTokenHealth(token) {
    try {
      const res = await fetch(`https://api.apify.com/v2/users/me?token=${token}`);
      if (!res.ok) return { ok: false, status: res.status };
      const data = await res.json();
      const plan = data.data?.plan || {};
      return {
        ok: true,
        username: data.data?.username,
        email: data.data?.email,
        maxCredit: plan.monthlyUsageCreditsUsd || 5,
        tier: plan.tier || 'FREE'
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async getActiveToken() {
    if (this.tokens.length === 0) {
      throw new Error('❌ Không tìm thấy Apify API Token nào trong .env (APIFY_TOKENS)!');
    }

    const startIndex = this.currentIndex;
    let attempts = 0;

    while (attempts < this.tokens.length) {
      const token = this.tokens[this.currentIndex];
      const health = await this.checkTokenHealth(token);

      if (health.ok) {
        console.log(`🔑 [Apify Token Pool] Đang dùng tài khoản: ${health.email || health.username} (Gói: ${health.tier} - Hạn mức: $${health.maxCredit}/tháng)`);
        return token;
      }

      console.warn(`⚠️ [Token Pool] Token #${this.currentIndex + 1} (${token.substring(0, 15)}...) không khả dụng hoặc hết hạn ngạch. Đang tự động xoay vòng...`);
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
      attempts++;
    }

    throw new Error('❌ Toàn bộ các Apify Token trong danh sách đều đã hết hạn mức hoặc không hợp lệ!');
  }
}

/**
 * Cost-Optimized Facebook Scraper via Apify Actor
 */
export async function scrapeFacebookPosts(targetUrl, options = {}) {
  const tokenPool = new ApifyTokenPool();
  const token = await tokenPool.getActiveToken();
  const maxPosts = options.maxPosts || 3; // Strict low count to preserve $5 free credit
  const actorId = options.actorId || process.env.APIFY_DEFAULT_ACTOR || 'apify/facebook-posts-scraper';

  console.log('='.repeat(70));
  console.log(`🌐 [APIFY FB SCRAPER] Bắt đầu cào dữ liệu từ Facebook:`);
  console.log(`   • Link Facebook mục tiêu : ${targetUrl}`);
  console.log(`   • Số lượng bài tối đa    : ${maxPosts} bài (Tối ưu tiết kiệm chi phí)`);
  console.log(`   • Actor chuyên dụng      : ${actorId}`);
  console.log('='.repeat(70));

  // Ultra cost-efficient actor input payload
  const runInput = {
    startUrls: [{ url: targetUrl }],
    resultsLimit: maxPosts,
    maxPosts: maxPosts,
    // Turn off expensive features to minimize execution time & cost (< $0.005)
    commentsMode: 'NONE',
    scrapeComments: false
  };

  const actorUrlSlug = actorId.replace('/', '~');
  const endpoint = `https://api.apify.com/v2/acts/${actorUrlSlug}/run-sync-get-dataset-items?token=${token}&memory=512&timeout=120`;

  console.log('⏳ Đang kết nối mạng proxy xoay vòng của Apify để cào nội dung an toàn...');
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(runInput)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apify API lỗi (${response.status}): ${errorText}`);
  }

  const rawItems = await response.json();
  console.log(`✅ [THÀNH CÔNG] Apify đã bốc được ${rawItems.length} mục dữ liệu từ Facebook!\n`);

  // Transform into OYL Viral Studio structure
  const transformedPosts = rawItems.map((item, idx) => {
    const text = item.text || item.message || item.postText || '';
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const firstLine = lines[0] || 'Bài viết chia sẻ định hướng';
    
    // Create snappy quote from first sentence
    const quote = firstLine.length > 120 ? firstLine.substring(0, 117) + '...' : firstLine;
    
    return {
      source_id: item.id || `fb_${Date.now()}_${idx}`,
      source_url: item.url || item.postUrl || targetUrl,
      author: item.user?.name || item.pageName || 'Lê Vĩnh',
      published_time: item.time || item.date || new Date().toISOString(),
      raw_text: text,
      // OYL Studio Card Format
      subhead: firstLine.substring(0, 70),
      quote: quote,
      caption: text,
      pillar: guessTopic(text),
      image_url: item.media?.[0]?.thumbnail || item.media?.[0]?.url || item.imageUrl || null,
      stats: {
        likes: item.likesCount || item.likes || 0,
        shares: item.sharesCount || item.shares || 0,
        comments: item.commentsCount || item.comments || 0
      }
    };
  });

  // Save results locally
  const outDir = path.join(rootDir, 'assets/scraped_data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const outFile = path.join(outDir, 'facebook_scraped_latest.json');
  fs.writeFileSync(outFile, JSON.stringify(transformedPosts, null, 2), 'utf-8');
  console.log(`💾 Đã lưu dữ liệu cào chuẩn hóa tại: ${outFile}`);

  return transformedPosts;
}

/**
 * AI/Keyword topic classifier
 */
function guessTopic(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('thi') || lower.includes('đgnl') || lower.includes('hsa') || lower.includes('tsa')) {
    return 'KỲ THI RIÊNG (HSA · TSA · V-ACT)';
  }
  if (lower.includes('học bổng') || lower.includes('vừa học vừa làm') || lower.includes('70%') || lower.includes('học phí')) {
    return 'HỌC BỔNG VỪA HỌC VỪA LÀM';
  }
  if (lower.includes('ngành') || lower.includes('tuyển sinh') || lower.includes('đại học') || lower.includes('chọn nghề')) {
    return 'TUYỂN SINH & CHỌN NGÀNH';
  }
  if (lower.includes('trí') || lower.includes('tư duy') || lower.includes('học tập')) {
    return 'LẬP TRÍ';
  }
  if (lower.includes('đạo') || lower.includes('đạo đức') || lower.includes('hiếu')) {
    return 'LẬP ĐẠO';
  }
  return 'LẬP NGHIỆP';
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('apifyScraper.js')) {
  const targetUrl = process.argv[2] || 'https://www.facebook.com/le.vinh.921';
  const limitArg = (process.argv.find(a => a.startsWith('--max=')) || '--max=3').split('=')[1];
  
  scrapeFacebookPosts(targetUrl, { maxPosts: Number(limitArg) })
    .then(posts => {
      console.log('\n📊 KẾT QUẢ DỮ LIỆU ĐÃ BỐC VỀ:');
      posts.forEach((p, i) => {
        console.log(`\n📌 [Bài #${i + 1}] Chủ đề: [${p.pillar}]`);
        console.log(`   • Trích dẫn : "${p.quote}"`);
        console.log(`   • Tương tác : 👍 ${p.stats.likes} | 💬 ${p.stats.comments} | 🔄 ${p.stats.shares}`);
        console.log(`   • Nội dung  : ${p.caption.substring(0, 150)}...`);
      });
    })
    .catch(err => {
      console.error('❌ Lỗi:', err.message);
    });
}
