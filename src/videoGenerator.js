import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ffmpegBinary = path.resolve(rootDir, '../node_modules/ffmpeg-static/ffmpeg');
const edgeTtsBinary = '/Users/nguyenphung/Library/Python/3.9/bin/edge-tts';
const outputVideosDir = path.join(rootDir, 'assets/videos');

if (!fs.existsSync(outputVideosDir)) {
  fs.mkdirSync(outputVideosDir, { recursive: true });
}

/**
 * Creates a spoken script tailored for high-retention vertical video (30-45s)
 */
function createSpokenScript(post) {
  const pillar = post.pillar || 'Định hướng nghề nghiệp';
  const subhead = post.subhead || post.quote.substring(0, 70);
  
  // Clean quote and caption for TTS speech
  let text = `${subhead}. `;
  
  // Extract key bullet points from caption (first 3-4 bullet lines)
  const lines = (post.caption || '').split('\n').filter(l => l.trim().length > 0);
  const contentLines = [];
  
  for (const line of lines) {
    if (line.includes('👉') || line.includes('#') || line.includes('Bố mẹ hãy')) continue;
    if (line.startsWith('1') || line.startsWith('2') || line.startsWith('3') || line.startsWith('✅') || line.startsWith('•') || line.startsWith('🎯')) {
      const cleanLine = line.replace(/^[0-9️⃣\.\•\-\✅\🎯\⚠️\💡\s]+/, '').trim();
      if (cleanLine.length > 10 && cleanLine.length < 120) {
        contentLines.push(cleanLine);
      }
    }
  }

  if (contentLines.length > 0) {
    text += contentLines.slice(0, 3).join('. ') + '. ';
  } else {
    text += post.quote.replace(/:/g, '. ') + '. ';
  }

  // Pronunciation fixes for common acronyms
  text = text.replace(/HSA/g, 'H S A')
             .replace(/TSA/g, 'T S A')
             .replace(/V-ACT/g, 'V ÁC')
             .replace(/V-SAT/g, 'V SÁT')
             .replace(/SPT/g, 'S P T')
             .replace(/H-SCA/g, 'H S C A')
             .replace(/OYL/g, 'O Y L')
             .replace(/OYLG/g, 'O Y L G')
             .replace(/THPT/g, 'Trung học phổ thông')
             .replace(/ĐH/g, 'Đại học');

  text += "Bố mẹ hãy bình luận hoặc nhắn tin cho O Y L Global và Nguyên Phụng để nhận trọn bộ tài liệu ôn thi nhé!";

  return text;
}

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

/**
 * Creates 1080x1920 Canvas with Gradient, Header, Quote Card, and Footer
 */
async function generateVideoFrame(post, cardImagePath, outputPath) {
  const width = 1080;
  const height = 1920;
  const partNumber = post.queue_index || post.id || 1;
  const topicTitle = escapeXml((post.pillar || 'ĐỊNH HƯỚNG TƯƠNG LAI').toUpperCase());
  const subhead = escapeXml((post.subhead || '').substring(0, 65));

  // 1. Create 1080x1920 base SVG background with rich luxury dark gradient & modern typography
  const svgOverlay = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0a1128" />
        <stop offset="30%" stop-color="#001f54" />
        <stop offset="70%" stop-color="#034078" />
        <stop offset="100%" stop-color="#0a1128" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#BF953F" />
        <stop offset="25%" stop-color="#FCF6BA" />
        <stop offset="50%" stop-color="#B38728" />
        <stop offset="75%" stop-color="#FBF5B7" />
        <stop offset="100%" stop-color="#AA771C" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="15" stdDeviation="25" flood-color="#000000" flood-opacity="0.8"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- Top Glow Line -->
    <rect x="90" y="70" width="900" height="3" fill="url(#goldGrad)" opacity="0.8" />

    <!-- Header Badge -->
    <g transform="translate(540, 150)">
      <!-- Pill box -->
      <rect x="-240" y="-35" width="480" height="60" rx="30" fill="#ffffff" fill-opacity="0.1" stroke="url(#goldGrad)" stroke-width="2" />
      <text x="0" y="5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="800" fill="#FCF6BA" text-anchor="middle" letter-spacing="3">
        OYL GLOBAL · BẢN TIN ĐỊNH HƯỚNG
      </text>
    </g>

    <!-- Part Title -->
    <g transform="translate(540, 260)">
      <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">
        【 PHẦN ${partNumber} 】
      </text>
      <text x="0" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="600" fill="#90e0ef" text-anchor="middle" letter-spacing="1">
        ${topicTitle}
      </text>
    </g>

    <!-- Bottom Footer Call to Action -->
    <g transform="translate(540, 1680)">
      <!-- Card background -->
      <rect x="-460" y="-80" width="920" height="150" rx="28" fill="#000814" fill-opacity="0.8" stroke="#1f4068" stroke-width="2" />
      
      <circle cx="-380" cy="-5" r="32" fill="url(#goldGrad)" />
      <!-- Star icon -->
      <text x="-380" y="5" font-size="28" text-anchor="middle" fill="#000814">★</text>
      
      <text x="-310" y="-18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="800" fill="#ffffff">
        Đồng hành cùng OYL Global &amp; Nguyên Phụng
      </text>
      <text x="-310" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="23" font-weight="500" fill="#a0aec0">
        👉 Nhắn tin hoặc để lại bình luận để nhận trọn bộ tài liệu!
      </text>
    </g>

    <!-- Bottom Glow Line -->
    <rect x="90" y="1860" width="900" height="3" fill="url(#goldGrad)" opacity="0.8" />
  </svg>
  `;

  // Resize quote card image to fit beautifully in 960x960 center area
  const resizedCardBuffer = await sharp(cardImagePath)
    .resize(960, 960, { fit: 'contain' })
    .composite([
      // Add subtle rounded border to card
      {
        input: Buffer.from(`
          <svg width="960" height="960">
            <rect x="0" y="0" width="960" height="960" rx="36" fill="none" stroke="#D4AF37" stroke-width="6" stroke-opacity="0.7"/>
          </svg>
        `),
        blend: 'over'
      }
    ])
    .png()
    .toBuffer();

  // Composite background SVG with Card
  await sharp(Buffer.from(svgOverlay))
    .composite([
      {
        input: resizedCardBuffer,
        top: 380, // Centered vertically in 1920 height
        left: 60
      }
    ])
    .png()
    .toFile(outputPath);

  return outputPath;
}

/**
 * Main function: Renders complete video for a given post
 */
export async function renderPostVideo(post, options = {}) {
  const postId = post.id || 1;
  const partNumber = post.queue_index || post.id || 1;
  const voice = options.voice || (partNumber % 2 === 0 ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural');
  const videoFileName = `phan_${partNumber}_post_${postId}_shorts.mp4`;
  const finalVideoPath = path.join(outputVideosDir, videoFileName);
  
  console.log('='.repeat(70));
  console.log(`🎬 [AUTO-VIDEO] Rendering Vertical Video (9:16) for 【 PHẦN ${partNumber} 】...`);
  console.log(`   • Post ID: #${postId}`);
  console.log(`   • Topic  : ${post.pillar}`);
  console.log(`   • Subhead: ${post.subhead}`);
  console.log(`   • Voice  : ${voice} (${voice.includes('Nam') ? 'Giọng Nam Trầm Ấm' : 'Giọng Nữ Truyền Cảm'})`);
  console.log('='.repeat(70));

  const tempAudioPath = path.join(outputVideosDir, `temp_audio_${postId}.mp3`);
  const tempTextPath = path.join(outputVideosDir, `temp_text_${postId}.txt`);
  const tempFramePath = path.join(outputVideosDir, `temp_frame_${postId}.png`);

  try {
    // 1. Generate Voiceover TTS
    const script = createSpokenScript(post);
    console.log(`🎙️  Generating Voiceover with Edge-TTS (${script.length} characters)...`);
    fs.writeFileSync(tempTextPath, script, 'utf-8');
    const ttsCmd = `"${edgeTtsBinary}" --voice "${voice}" -f "${tempTextPath}" --write-media "${tempAudioPath}"`;
    execSync(ttsCmd);
    console.log(`✅ Voiceover generated: ${tempAudioPath}`);

    // 2. Generate High-Res 9:16 Composite Frame
    const cardImgPath = path.resolve(rootDir, post.image_path);
    console.log(`🎨 Generating 1080x1920 Frame with Quote Card & OYL Brand Assets...`);
    await generateVideoFrame(post, cardImgPath, tempFramePath);
    console.log(`✅ Frame rendered: ${tempFramePath}`);

    // 3. Render MP4 with FFmpeg (Smooth zoom motion + Audio)
    console.log(`⚡ Encoding 9:16 Video with FFmpeg H.264 & AAC...`);
    
    // Zoom motion filter: slow elegant Ken Burns effect (1.00 -> 1.04)
    const ffmpegCmd = `"${ffmpegBinary}" -y -loop 1 -i "${tempFramePath}" -i "${tempAudioPath}" \
      -filter_complex "[0:v]scale=1080:1920,zoompan=z='min(zoom+0.0003,1.04)':d=125:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30[v]" \
      -map "[v]" -map 1:a -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "${finalVideoPath}"`;

    execSync(ffmpegCmd);
    console.log(`\n🎉 [SUCCESS] Video Rendered Successfully!`);
    console.log(`📁 File Location : ${finalVideoPath}`);
    
    const stats = fs.statSync(finalVideoPath);
    console.log(`📊 File Size     : ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`📐 Aspect Ratio  : 9:16 (1080x1920 Vertical HD)`);
    console.log('='.repeat(70) + '\n');

    return {
      success: true,
      videoPath: finalVideoPath,
      sizeBytes: stats.size
    };
  } finally {
    // Clean up temp files
    if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
    if (fs.existsSync(tempTextPath)) fs.unlinkSync(tempTextPath);
    if (fs.existsSync(tempFramePath)) fs.unlinkSync(tempFramePath);
  }
}

// CLI Execution: supports --range=2-5 or --part=2 or defaults to batch
if (process.argv[1] && process.argv[1].endsWith('videoGenerator.js')) {
  const db = JSON.parse(fs.readFileSync(path.join(rootDir, 'database.json'), 'utf-8'));
  
  const rangeArg = process.argv.find(a => a.startsWith('--range='));
  const partArg = process.argv.find(a => a.startsWith('--part='));

  async function runCLI() {
    let targetPosts = [];
    if (rangeArg) {
      const [start, end] = rangeArg.split('=')[1].split('-').map(Number);
      targetPosts = db.filter(p => p.queue_index >= start && p.queue_index <= end);
    } else if (partArg) {
      const pNum = Number(partArg.split('=')[1]);
      targetPosts = db.filter(p => p.queue_index === pNum);
    } else {
      // Default: render parts 2 to 5
      targetPosts = db.filter(p => p.queue_index >= 2 && p.queue_index <= 5);
    }

    console.log(`🚀 Starting batch video generation for ${targetPosts.length} post(s)...\n`);
    for (const post of targetPosts) {
      await renderPostVideo(post);
    }
    console.log(`\n🎉 [COMPLETE] All ${targetPosts.length} video(s) have been rendered in ./assets/videos/`);
  }

  runCLI();
}
