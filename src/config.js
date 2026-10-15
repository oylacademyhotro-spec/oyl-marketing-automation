import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Load .env
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

export const config = {
  rootDir: ROOT_DIR,
  databasePath: path.join(ROOT_DIR, 'database.json'),
  assetsDir: path.join(ROOT_DIR, 'assets', 'posts'),
  
  targetUrl: process.env.TARGET_URL || 'https://oyl-viral-studio.vercel.app/',
  
  // Facebook Page A (Du học toàn cầu OYLG)
  pageA: {
    id: process.env.PAGE_A_ID || '553627547827807',
    token: process.env.PAGE_A_TOKEN || 'EAAWankjKpZA4BShPVp977MQS9vSNYGImrS5ZBrE6qIkibRXDP8ZBQXTyzXr1nCtH9FR6YYVDQZCZC8XKA9ZBwYZCnNpxACWLckHtjEBiq4fdpLnxbU8goBmFZCQoO5NyXT2nYHydAItgzh6OvUvJ5RHuzbldHgQJ6XE7HRNbJRYVhZApEeZC0AEMZCE473gYAELylGiUvYAnYZBa0SsEIs8V1OCxMKyaZBNVVZBoPrbTRlYrDY4waeoePUwMEHL8gZD',
    name: process.env.PAGE_A_NAME || 'Du học toàn cầu OYLG',
    brandCta: process.env.PAGE_A_CTA || '👉 Bố mẹ hãy comment hoặc nhắn tin trực tiếp để nhận lộ trình chi tiết và tư vấn 1:1 từ chuyên gia OYL Global!',
    hashtags: process.env.PAGE_A_HASHTAGS || '#OwnYourLifeGlobal #OYLGlobal #DinhHuongTuongLai #ThamVanHuongNghiep #CungConLapNghiep #GiaoDucThoiDaiMoi'
  },
  
  // Facebook Page B (Nguyên Phụng)
  pageB: {
    id: process.env.PAGE_B_ID || '111979613513276',
    token: process.env.PAGE_B_TOKEN || 'EAAWankjKpZA4BSlhDRTceBCL9le9G5ETF8JuJgVdXr4cYypxZC6yvYWyvtnR3QVcrLpum9lnpvB245ZAQih3drEJkJYFlreQzxGxjZApf2KtoMUfvhsGX8Shi1jhYJgkiMueKJ9tzfB3TPqUNMatEZBQ0K0mrEf2PwJZBggZCW0LO0cKOGpQrXLt6h9LEabbkqsZBHkk4SuK9xSAZBXNx6KCWNe0mHgWieatu5YFhLe6cKHSy48ZBqtDCDjwZDZD',
    name: process.env.PAGE_B_NAME || 'Nguyên Phụng',
    brandCta: process.env.PAGE_B_CTA || '💬 Để lại dấu "." hoặc inbox ngay cho Nguyên Phụng & OYL Global để được hỗ trợ định hướng và nhận trọn bộ tài liệu nhé!',
    hashtags: process.env.PAGE_B_HASHTAGS || '#NguyenPhung #OYL #TuChuCuocDoi #BiQuyetChonNganh #HocBong7030 #KyThiRieng #ChinhPhucDaiHoc'
  },

  fbApiVersion: process.env.FB_API_VERSION || 'v20.0',
  
  // Scheduling & Jitter
  randomJitterMaxMinutes: parseInt(process.env.RANDOM_JITTER_MAX_MINUTES || '10', 10),
  dryRun: process.env.DRY_RUN === 'true',
  
  // Daily Cron times
  cron: {
    syncCheck: process.env.CRON_SYNC || '30 7 * * *', // 07:30 daily
    
    // Page A slots (08:00, 14:00, 19:00)
    pageASlots: [
      { time: '08:00', cron: '0 8 * * *', label: 'Ca sáng (Page A)' },
      { time: '14:00', cron: '0 14 * * *', label: 'Ca chiều (Page A)' },
      { time: '19:00', cron: '0 19 * * *', label: 'Ca tối (Page A)' }
    ],
    
    // Page B slots (08:45, 14:45, 19:45) - Staggered by 45 minutes
    pageBSlots: [
      { time: '08:45', cron: '45 8 * * *', label: 'Ca sáng (Page B - So le)' },
      { time: '14:45', cron: '45 14 * * *', label: 'Ca chiều (Page B - So le)' },
      { time: '19:45', cron: '45 19 * * *', label: 'Ca tối (Page B - So le)' }
    ]
  }
};
