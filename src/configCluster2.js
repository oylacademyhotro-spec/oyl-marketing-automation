import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const configCluster2 = {
  rootDir,
  clusterName: 'CỤM 2: HỌC VIỆN & TRAINER NGUYÊN PHỤNG (CAREER COACH)',
  targetUrl: 'https://oyl-career-coach-studio.vercel.app/',
  databaseFile: path.join(rootDir, 'database_cluster2.json'),
  csvSource: '/Users/nguyenphung/brain2/vault/OYL_Career_Coach_Studio.csv',
  postsDir: path.join(rootDir, 'assets', 'posts_cluster2'),
  videosDir: path.join(rootDir, 'assets', 'videos'),

  // FANPAGE C: HỌC VIỆN OWN YOUR LIFE
  pageC: {
    id: process.env.PAGE_C_ID || '103484708439848',
    token: process.env.PAGE_C_TOKEN || '',
    name: process.env.PAGE_C_NAME || 'Học Viện Own Your Life',
    cta: '👉 Thầy cô, phụ huynh và chuyên gia quan tâm đến Nghề Tham Vấn Hướng Nghiệp & Đề án 300 Mentor hãy để lại tin nhắn hoặc comment để nhận tài liệu chuyên sâu nhé!',
    hashtags: '#OwnYourLifeGlobal #OYL #HocVienOwnYourLife #thamvanhuongnghiep #cungconlapnghiep #CareerCoach #300Mentor'
  },

  // FANPAGE D: TRAINER NGUYÊN PHỤNG
  pageD: {
    id: process.env.PAGE_D_ID || '982336264968925',
    token: process.env.PAGE_D_TOKEN || '',
    name: process.env.PAGE_D_NAME || 'Trainer Nguyên Phụng',
    cta: '💬 Để lại dấu "." hoặc inbox ngay cho Trainer Nguyên Phụng để cùng kết nối và rèn luyện kỹ năng khai vấn thực chiến!',
    hashtags: '#TrainerNguyenPhung #NguyenPhung #HienThan #SomaticCoaching #ThamVanHuongNghiep #CareerCoach #TuChuCuocDoi'
  },

  fbApiVersion: process.env.FB_API_VERSION || 'v20.0',
  randomJitterMaxMinutes: parseInt(process.env.RANDOM_JITTER_MAX_MINUTES || '10', 10),
  dryRun: process.env.DRY_RUN === 'true',

  // LỊCH ĐĂNG: MỖI NGÀY 2 BÀI VIẾT + 2 VIDEO REELS
  cron: {
    // 1. Bài viết Ca Sáng (08:00 Học Viện OYL - 08:45 Trainer Nguyên Phụng)
    // 2. Bài viết Ca Tối (19:30 Học Viện OYL - 20:15 Trainer Nguyên Phụng)
    pageCSlots: [
      { time: '08:00', cron: '0 8 * * *', label: 'Ca sáng (Học Viện OYL)' },
      { time: '19:30', cron: '30 19 * * *', label: 'Ca tối (Học Viện OYL)' }
    ],
    pageDSlots: [
      { time: '08:45', cron: '45 8 * * *', label: 'Ca sáng (Trainer Nguyên Phụng - So le)' },
      { time: '20:15', cron: '15 20 * * *', label: 'Ca tối (Trainer Nguyên Phụng - So le)' }
    ],

    // 2 Video Reels mỗi ngày (Ca sáng 07:00 & Ca tối 18:30)
    videoSlots: [
      { time: '07:00', cron: '0 7 * * *', label: 'Ca Video Sáng (07:00)' },
      { time: '18:30', cron: '30 18 * * *', label: 'Ca Video Tối (18:30)' }
    ]
  }
};

export default configCluster2;
