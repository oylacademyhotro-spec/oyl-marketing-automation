import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.join(rootDir, 'database.json');
const exportDir = path.join(rootDir, 'notebooklm_exports');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const posts = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
console.log(`Loaded ${posts.length} posts from database.json.`);

// 1. Group posts by Pillar
const pillarGroups = {};
posts.forEach(p => {
  const pillar = p.pillar || 'CHỦ ĐỀ CHUNG';
  if (!pillarGroups[pillar]) pillarGroups[pillar] = [];
  pillarGroups[pillar].push(p);
});

// Helper to format a post for NotebookLM
function formatPostMarkdown(post, index) {
  return `### 【 BÀI ${post.queue_index || index} 】: ${post.subhead || post.quote.substring(0, 80)}
- **Mã bài viết**: #${post.id} (Thứ tự phát sóng: #${post.queue_index})
- **Chủ đề lớn (Pillar)**: ${post.pillar}
- **Thông điệp then chốt (Quote)**:
> "${post.quote}"

#### Nội dung chi tiết & Lời khuyên định hướng:
${post.caption}

- **Từ khóa & Hashtags**: ${post.hashtag || 'N/A'}
---
`;
}

// 2. Generate Master File (All 210 Posts)
let masterDoc = `# KHO DỮ LIỆU TRI THỨC ĐỊNH HƯỚNG & HƯỚNG NGHIỆP — OYL GLOBAL (210 CHUYÊN ĐỀ)
*Biên soạn bởi Antigravity Marketing Automation Engine cho Học Viện Đào Tạo OYL Global & Trainer Nguyên Phụng*

---

## MỤC LỤC & TỔNG QUAN HỆ SINH THÁI TRI THỨC:
- Tổng số bài viết & kịch bản: ${posts.length} bài
- Số lượng nhóm chủ đề trọng điểm: ${Object.keys(pillarGroups).length} nhóm
${Object.entries(pillarGroups).map(([pillar, items]) => `  • **${pillar}**: ${items.length} bài chuyên sâu`).join('\n')}

---

## NỘI DUNG CHI TIẾT TOÀN BỘ ${posts.length} BÀI HỌC:

`;

posts.forEach((p, idx) => {
  masterDoc += formatPostMarkdown(p, idx + 1);
});

const masterFilePath = path.join(exportDir, 'OYL_KHO_TRI_THUC_TOAN_DIEN_210_BAI.md');
fs.writeFileSync(masterFilePath, masterDoc, 'utf-8');
console.log(`✅ Exported Master Document: ${masterFilePath} (${(Buffer.byteLength(masterDoc) / 1024).toFixed(1)} KB)`);

// 3. Generate Individual Pillar Files for modular NotebookLM upload
const pillarFileMapping = {
  'TUYỂN SINH & CHỌN NGÀNH': '01_Tuyen_Sinh_Va_Chon_Nganh.md',
  'HỌC BỔNG VỪA HỌC VỪA LÀM': '02_Hoc_Bong_70_30_Vua_Hoc_Vua_Lam.md',
  'KỲ THI RIÊNG (HSA · TSA · V-ACT)': '03_Ky_Thi_Rieng_HSA_TSA_VACT.md',
  'LẬP TRÍ': '04_Tri_Tue_Va_Lap_Tri.md',
  'LẬP ĐẠO': '05_Dao_Duc_Va_Lap_Dao.md',
  'LẬP THÂN': '06_Nang_Luc_Va_Lap_Than.md',
  'LẬP NGHIỆP': '07_Su_Nghiep_Va_Lap_Nghiep.md'
};

for (const [pillar, items] of Object.entries(pillarGroups)) {
  const fileName = pillarFileMapping[pillar] || `${pillar.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
  const filePath = path.join(exportDir, fileName);
  
  let pillarDoc = `# CHUYÊN ĐỀ: ${pillar} — OYL GLOBAL
*Tài liệu tri thức chuẩn hóa dành cho NotebookLM Audio Overview & Content Creator*
*Tổng cộng: ${items.length} bài viết và kịch bản thực chiến.*

---

`;
  items.forEach((p, idx) => {
    pillarDoc += formatPostMarkdown(p, idx + 1);
  });

  fs.writeFileSync(filePath, pillarDoc, 'utf-8');
  console.log(`  📄 Exported Topic [${pillar}]: ${fileName} (${items.length} posts)`);
}

console.log('\n🎉 Hoàn tất xuất toàn bộ tài liệu cho NotebookLM tại thư mục ./notebooklm_exports/');
