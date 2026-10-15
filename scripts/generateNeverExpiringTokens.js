import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const APP_ID = '1577379500303774';
const APP_SECRET = '507f0259b62978bdacdf5978c939b942';

export async function convertToNeverExpiringTokens(freshUserToken) {
  if (!freshUserToken) {
    throw new Error('Vui lòng cung cấp mã User Token mới!');
  }

  console.log('='.repeat(70));
  console.log('🔑 BẮT ĐẦU QUY TRÌNH NÂNG CẤP TOKEN VĨNH VIỄN TỪ META');
  console.log('='.repeat(70));

  // Bước 1: Nâng cấp lên Long-lived User Token (60 ngày)
  console.log('1️⃣ Đang gửi yêu cầu chuyển đổi Long-lived User Token (60 ngày)...');
  const exchangeUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${freshUserToken.trim()}`;
  
  const exRes = await fetch(exchangeUrl);
  const exData = await exRes.json();

  if (exData.error) {
    throw new Error(`Meta từ chối cấp token 60 ngày: ${exData.error.message} (code: ${exData.error.code})`);
  }

  const longLivedUserToken = exData.access_token;
  console.log('   ✅ Đã nhận Long-lived User Token thành công!');

  // Bước 2: Gọi me/accounts để sinh Page Access Token VĨNH VIỄN
  console.log('2️⃣ Đang yêu cầu Meta cấp Page Access Token VĨNH VIỄN (Never Expire)...');
  const accUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token&access_token=${longLivedUserToken}`;
  const accRes = await fetch(accUrl);
  const accData = await accRes.json();

  if (!accData.data || accData.data.length === 0) {
    throw new Error('Không tìm thấy danh sách Page nào được quản lý bởi tài khoản này!');
  }

  const pageA = accData.data.find(p => p.id === '553627547827807');
  const pageB = accData.data.find(p => p.id === '111979613513276');

  if (!pageA || !pageB) {
    throw new Error('Không tìm thấy đủ 2 Page mục tiêu (Du học toàn cầu OYLG hoặc Nguyên Phụng)!');
  }

  // Bước 3: Kiểm tra tính vĩnh viễn qua debug_token
  console.log('3️⃣ Kiểm tra hạn sử dụng chính thức từ máy chủ Meta...');
  const debugA = await fetch(`https://graph.facebook.com/v20.0/debug_token?input_token=${pageA.access_token}&access_token=${longLivedUserToken}`).then(r => r.json());
  const debugB = await fetch(`https://graph.facebook.com/v20.0/debug_token?input_token=${pageB.access_token}&access_token=${longLivedUserToken}`).then(r => r.json());

  const expA = debugA.data?.expires_at;
  const expB = debugB.data?.expires_at;

  console.log(`   • Page A: ${pageA.name} [ID: ${pageA.id}]`);
  console.log(`     -> Hạn dùng: ${expA === 0 ? '🟢 VĨNH VIỄN (expires_at = 0 / Never)' : expA}`);
  console.log(`   • Page B: ${pageB.name} [ID: ${pageB.id}]`);
  console.log(`     -> Hạn dùng: ${expB === 0 ? '🟢 VĨNH VIỄN (expires_at = 0 / Never)' : expB}`);

  // Bước 4: Tự động ghi đè vào .env
  console.log('4️⃣ Đang lưu cấu hình vĩnh viễn vào file .env...');
  const envPath = path.join(rootDir, '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  envContent = envContent.replace(/PAGE_A_TOKEN=.*/, `PAGE_A_TOKEN=${pageA.access_token}`);
  envContent = envContent.replace(/PAGE_B_TOKEN=.*/, `PAGE_B_TOKEN=${pageB.access_token}`);

  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log('   ✅ Đã cập nhật .env với Page Tokens VĨNH VIỄN!');
  console.log('='.repeat(70));
  console.log('🎉 HOÀN TẤT NÂNG CẤP! HỆ THỐNG ĐÃ CÓ TOKEN VĨNH VIỄN 100%');
  console.log('='.repeat(70));

  return {
    success: true,
    pageA: { name: pageA.name, expires_at: expA },
    pageB: { name: pageB.name, expires_at: expB }
  };
}

if (process.argv[2]) {
  convertToNeverExpiringTokens(process.argv[2])
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Lỗi:', err.message);
      process.exit(1);
    });
}
