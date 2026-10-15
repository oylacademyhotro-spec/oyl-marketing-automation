import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const APP_ID = '1577379500303774';
const APP_SECRET = '507f0259b62978bdacdf5978c939b942';

export async function convertCluster2Tokens(freshUserToken) {
  if (!freshUserToken) {
    throw new Error('Vui lòng cung cấp mã User Token mới từ Graph API Explorer!');
  }

  console.log('='.repeat(70));
  console.log('🔑 NÂNG CẤP TOKEN VĨNH VIỄN CHO CỤM 2: HỌC VIỆN & TRAINER NGUYÊN PHỤNG');
  console.log('='.repeat(70));

  // 1. Nâng cấp User Token lên 60 ngày
  console.log('1️⃣ Đổi Long-lived User Token (60 ngày)...');
  const exUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${freshUserToken.trim()}`;
  const exRes = await fetch(exUrl).then(r => r.json());
  if (exRes.error) {
    throw new Error(`Meta từ chối: ${exRes.error.message} (code: ${exRes.error.code})`);
  }
  const longUserToken = exRes.access_token;
  console.log('   ✅ Đã nhận Long-lived User Token!');

  // 2. Lấy danh sách me/accounts
  console.log('2️⃣ Lấy Page Access Token vĩnh viễn từ me/accounts...');
  const accUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${longUserToken}`;
  const accRes = await fetch(accUrl).then(r => r.json());
  if (!accRes.data) {
    throw new Error('Không lấy được danh sách Page từ tài khoản này!');
  }

  const pageC = accRes.data.find(p => p.id === '103484708439848');
  const pageD = accRes.data.find(p => p.id === '982336264968925');

  if (!pageC || !pageD) {
    console.log('Danh sách các Page tìm thấy trong tài khoản:', accRes.data.map(p => `${p.name} [ID: ${p.id}]`));
    throw new Error('Không tìm thấy đủ 2 Page: Học Viện Own Your Life (103484708439848) hoặc Trainer Nguyên Phụng (982336264968925)!');
  }

  // 3. Debug hạn token
  const debugC = await fetch(`https://graph.facebook.com/v20.0/debug_token?input_token=${pageC.access_token}&access_token=${longUserToken}`).then(r => r.json());
  const debugD = await fetch(`https://graph.facebook.com/v20.0/debug_token?input_token=${pageD.access_token}&access_token=${longUserToken}`).then(r => r.json());

  console.log(`   • Page C: ${pageC.name} [ID: ${pageC.id}] -> Hạn dùng: ${debugC.data?.expires_at === 0 ? '🟢 VĨNH VIỄN (Never Expire)' : debugC.data?.expires_at}`);
  console.log(`   • Page D: ${pageD.name} [ID: ${pageD.id}] -> Hạn dùng: ${debugD.data?.expires_at === 0 ? '🟢 VĨNH VIỄN (Never Expire)' : debugD.data?.expires_at}`);

  // 4. Cập nhật .env
  console.log('3️⃣ Lưu cấu hình vào file .env...');
  const envPath = path.join(rootDir, '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  // Ghi thêm PAGE_C và PAGE_D nếu chưa có
  if (!envContent.includes('PAGE_C_ID=')) {
    envContent += `\n# ------------------------------------------------------------\n# CLUSTER 2: HỌC VIỆN & TRAINER NGUYÊN PHỤNG\n# ------------------------------------------------------------\nPAGE_C_ID=103484708439848\nPAGE_C_TOKEN=${pageC.access_token}\nPAGE_C_NAME=Học Viện Own Your Life\n\nPAGE_D_ID=982336264968925\nPAGE_D_TOKEN=${pageD.access_token}\nPAGE_D_NAME=Trainer Nguyên Phụng\n`;
  } else {
    envContent = envContent.replace(/PAGE_C_TOKEN=.*/, `PAGE_C_TOKEN=${pageC.access_token}`);
    envContent = envContent.replace(/PAGE_D_TOKEN=.*/, `PAGE_D_TOKEN=${pageD.access_token}`);
  }

  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log('   ✅ Đã lưu Page Tokens VĨNH VIỄN cho Cụm 2!');
  console.log('='.repeat(70));
  console.log('🎉 CỤM 2 ĐÃ SẴN SÀNG ĐĂNG BÀI 2 BÀI + 2 VIDEO / NGÀY!');
  console.log('='.repeat(70));

  return { success: true, pageC: pageC.name, pageD: pageD.name };
}

if (process.argv[2]) {
  convertCluster2Tokens(process.argv[2])
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Lỗi:', err.message);
      process.exit(1);
    });
}
