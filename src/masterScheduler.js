import http from 'http';
import { startScheduler } from './scheduler.js';
import { startCluster2Scheduler } from './schedulerCluster2.js';

console.log('🌟 [MASTER ENGINE] Khởi động toàn bộ 4 Fanpages của OYL Global...');
console.log('------------------------------------------------------------');

// 1. Khởi động Cụm 1: Tuyển sinh & Du học Toàn cầu
startScheduler();

// 2. Khởi động Cụm 2: Học Viện & Trainer Nguyên Phụng (Career Coach)
startCluster2Scheduler();

// 3. Khởi động cổng HTTP Health Check phục vụ Render Web Service
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🟢 OYL Marketing Automation Engine (4 Fanpages) is running 24/7!\n');
}).listen(PORT, () => {
  console.log(`🌍 Health Check HTTP Server sẵn sàng trên cổng ${PORT}`);
});

console.log('🚀 [MASTER ENGINE] Cả 2 Cụm (4 Fanpages) đã vận hành đồng thời!');
