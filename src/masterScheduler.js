import { startScheduler } from './scheduler.js';
import { startCluster2Scheduler } from './schedulerCluster2.js';

console.log('🌟 [MASTER ENGINE] Khởi động toàn bộ 4 Fanpages của OYL Global...');
console.log('------------------------------------------------------------');

// 1. Khởi động Cụm 1: Tuyển sinh & Du học Toàn cầu
startScheduler();

// 2. Khởi động Cụm 2: Học Viện & Trainer Nguyên Phụng (Career Coach)
startCluster2Scheduler();

console.log('🚀 [MASTER ENGINE] Cả 2 Cụm (4 Fanpages) đã vận hành đồng thời!');
