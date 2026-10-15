import { config } from './config.js';

/**
 * CAPTION VARIATOR ENGINE
 * Automatically customizes and differentiates captions between Page A and Page B:
 * - Page A: Original authoritative Hook, full structured core body, Page A CTA & hashtags.
 * - Page B: Varied engaging Hook, exact core message preserved, unique Page B CTA & hashtags.
 */

// Rotating Hook formulas for Page B based on topic
const HOOK_PATTERNS = [
  (quote, pillar) => `✨ [BỐ MẸ VÀ CÁC CON ĐÃ BIẾT CHƯA?]\n“${quote}”\n\n📌 Góc nhìn định hướng từ OYL Global:`,
  (quote, pillar) => `⚡ CHIẾN LƯỢC QUAN TRỌNG KHÔNG THỂ BỎ LỠ VỀ ${pillar}:\n“${quote}”\n\nCùng điểm qua những thông tin then chốt ngay sau đây:`,
  (quote, pillar) => `💡 LỜI KHUYÊN ĐẮT GIÁ CHO MÙA TUYỂN SINH & HƯỚNG NGHIỆP:\n“${quote}”\n\n👉 Chi tiết lộ trình bố mẹ và con cần lưu tâm:`,
  (quote, pillar) => `🔥 ĐÂY LÀ ĐIỀU MỌI GIA ĐÌNH CẦN NẮM RÕ ĐỂ CON TỰ CHỦ TƯƠNG LAI:\n“${quote}”\n\nThông điệp cốt lõi gửi gắm:`,
  (quote, pillar) => `🚀 HÀNH TRANG THỰC CHIẾN — TẠI SAO BẠN CẦN BIẾT ĐIỀU NÀY?\n“${quote}”\n\nPhân tích chi tiết:`
];

// Rotating CTAs for Page B
const PAGE_B_CTAS = [
  '💬 Bố mẹ hãy để lại bình luận hoặc gửi tin nhắn cho OYL Global để được tham vấn 1:1 miễn phí nhé!',
  '👉 Nhắn tin cho OYL ngay hôm nay để nhận trọn bộ cẩm nang hướng nghiệp & học bổng mới nhất bố mẹ nhé!',
  '🌟 Hãy chia sẻ bài viết này cho bạn bè hoặc để lại dấu "." dưới phần bình luận để nhận hỗ trợ tận tình từ OYL!',
  '📥 Đừng ngần ngại inbox để chuyên gia OYL Global đồng hành vạch ra lộ trình riêng biệt cho con!'
];

export function generatePageACaption(post) {
  const partNumber = post.queue_index || post.id || 1;
  const partTag = `【 PHẦN ${partNumber} 】`;
  const quoteLine = `“${post.quote}”`;
  
  // Extract core body from caption (remove old hashtags if attached)
  let body = post.caption || '';
  // Remove CTA if repeated
  body = body.replace(/👉\s*Bố mẹ hãy comment.*?nhé!/gi, '').trim();

  const cta = config.pageA.brandCta;
  const hashtags = config.pageA.hashtags;

  return `${partTag}\n\n${quoteLine}\n\n${body}\n\n${cta}\n\n${hashtags}`;
}

export function generatePageBCaption(post) {
  const partNumber = post.queue_index || post.id || 1;
  const partTag = `【 PHẦN ${partNumber} 】`;
  const pillar = post.pillar || 'ĐỊNH HƯỚNG';
  
  // Pick deterministic but varied hook based on post.id
  const hookIndex = (post.id || 0) % HOOK_PATTERNS.length;
  const hook = HOOK_PATTERNS[hookIndex](post.quote, pillar);

  // Extract core body from caption
  let body = post.caption || '';
  // Remove old opening duplicate line if it mirrors the quote
  const lines = body.split('\n');
  if (lines.length > 0 && (lines[0].includes('🎯 TỔNG HỢP') || lines[0].includes('BẢN ĐỒ'))) {
    lines.shift();
    body = lines.join('\n').trim();
  }
  body = body.replace(/👉\s*Bố mẹ hãy comment.*?nhé!/gi, '').trim();

  // Pick rotating Page B CTA
  const ctaIndex = (post.id || 0) % PAGE_B_CTAS.length;
  const cta = PAGE_B_CTAS[ctaIndex];
  const hashtags = config.pageB.hashtags;

  return `${partTag}\n\n${hook}\n\n${body}\n\n${cta}\n\n${hashtags}`;
}

/**
 * Returns prepared payload for a specific target page ('A' or 'B')
 */
export function preparePostPayload(post, targetPage = 'A') {
  const isPageB = targetPage.toUpperCase() === 'B';
  return {
    page: isPageB ? 'B' : 'A',
    postId: post.id,
    topic: post.pillar,
    caption: isPageB ? generatePageBCaption(post) : generatePageACaption(post),
    imagePath: isPageB && post.mutated_image_path ? post.mutated_image_path : post.image_path,
    scheduledSlot: post.scheduled_slot,
    scheduledDay: post.scheduled_day
  };
}
