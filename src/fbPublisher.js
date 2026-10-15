import fs from 'fs';
import path from 'path';
import { config } from './config.js';

/**
 * FACEBOOK GRAPH API PUBLISHER
 * Handles photo uploads with captions to Facebook Fanpages A and B.
 * Supports:
 * - Graph API v20.0
 * - Multipart/form-data upload using Node native FormData & Blob
 * - Dry-run mode for zero-risk testing
 * - Automatic retry with exponential backoff on transient errors
 */

export class FacebookPublisher {
  constructor(options = {}) {
    this.dryRun = options.dryRun ?? config.dryRun;
    this.apiVersion = options.apiVersion || config.fbApiVersion;
  }

  /**
   * Retrieves page credentials for 'A', 'B', 'C', or 'D', or uses custom overrides
   */
  getPageCredentials(pageKey = 'A', customToken = null, customPageId = null) {
    if (customToken && customPageId) {
      return {
        pageKey,
        name: pageKey === 'C' ? 'Học Viện Own Your Life' : (pageKey === 'D' ? 'Trainer Nguyên Phụng' : `Page ${pageKey}`),
        pageId: customPageId,
        token: customToken
      };
    }

    const key = pageKey.toUpperCase();
    let pageConfig = config.pageA;
    if (key === 'B') pageConfig = config.pageB;
    if (key === 'C') pageConfig = { name: process.env.PAGE_C_NAME || 'Học Viện Own Your Life', id: process.env.PAGE_C_ID || '103484708439848', token: process.env.PAGE_C_TOKEN || '' };
    if (key === 'D') pageConfig = { name: process.env.PAGE_D_NAME || 'Trainer Nguyên Phụng', id: process.env.PAGE_D_ID || '982336264968925', token: process.env.PAGE_D_TOKEN || '' };

    return {
      pageKey: key,
      name: pageConfig.name,
      pageId: pageConfig.id,
      token: pageConfig.token
    };
  }

  /**
   * Validates if token and page ID are properly configured
   */
  async validatePageConnection(pageKey = 'A') {
    const { pageId, token, name } = this.getPageCredentials(pageKey);

    if (this.dryRun) {
      return {
        ok: true,
        dryRun: true,
        message: `[DRY-RUN] ${name} (ID: ${pageId || 'SIMULATED'}) connection validated.`
      };
    }

    if (!pageId || !token) {
      return {
        ok: false,
        error: `Page ${pageKey} is missing PAGE_${pageKey}_ID or PAGE_${pageKey}_TOKEN in .env`
      };
    }

    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${pageId}?fields=id,name,fan_count&access_token=${token}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        return {
          ok: false,
          error: `Facebook Graph API error: ${data.error.message} (code: ${data.error.code})`
        };
      }

      return {
        ok: true,
        pageId: data.id,
        pageName: data.name,
        fanCount: data.fan_count
      };
    } catch (err) {
      return {
        ok: false,
        error: `Network error connecting to Facebook API: ${err.message}`
      };
    }
  }

  /**
   * Publishes a photo post with caption to the specified Fanpage
   */
  async publishPhoto({
    pageKey = 'A',
    imagePath,
    caption,
    customToken = null,
    customPageId = null,
    retries = 2
  }) {
    const { pageId, token, name } = this.getPageCredentials(pageKey, customToken, customPageId);

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file does not exist: ${imagePath}`);
    }

    // DRY RUN MODE: Simulate publication without calling FB API
    if (this.dryRun || !pageId || !token) {
      const simulatedId = `sim_photo_${pageKey.toLowerCase()}_${Date.now()}`;
      const simulatedPostId = `${pageId || 'PAGE_ID'}_${simulatedId}`;

      return {
        success: true,
        dryRun: true,
        pageKey,
        pageName: name,
        photoId: simulatedId,
        postId: simulatedPostId,
        imagePath,
        captionPreview: caption.substring(0, 120) + '...',
        publishedAt: new Date().toISOString()
      };
    }

    // PRODUCTION MODE: Real Graph API upload
    const fileBuffer = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('access_token', token);
    formData.append('caption', caption);
    formData.append('source', blob, fileName);

    const endpoint = `https://graph.facebook.com/${this.apiVersion}/${pageId}/photos`;

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.error) {
          // If transient error (rate limit, temporary server error), retry
          const isTransient = [1, 2, 4, 17, 341].includes(data.error.code);
          if (isTransient && attempt < retries) {
            attempt++;
            const backoffMs = Math.pow(2, attempt) * 2000;
            console.warn(`[FB ${name}] Transient error: ${data.error.message}. Retrying in ${backoffMs}ms...`);
            await new Promise(r => setTimeout(r, backoffMs));
            continue;
          }
          throw new Error(`Facebook API Error (${data.error.code}): ${data.error.message}`);
        }

        return {
          success: true,
          dryRun: false,
          pageKey,
          pageName: name,
          photoId: data.id,
          postId: data.post_id || `${pageId}_${data.id}`,
          imagePath,
          publishedAt: new Date().toISOString()
        };
      } catch (err) {
        if (attempt < retries) {
          attempt++;
          const backoffMs = Math.pow(2, attempt) * 2000;
          console.warn(`[FB ${name}] Request failed: ${err.message}. Retrying in ${backoffMs}ms...`);
          await new Promise(r => setTimeout(r, backoffMs));
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Publishes a video (Reels / Video Post) to the specified Fanpage
   */
  async publishVideo({
    pageKey = 'A',
    videoPath,
    title,
    description,
    customToken = null,
    customPageId = null,
    retries = 2
  }) {
    const { pageId, token, name } = this.getPageCredentials(pageKey, customToken, customPageId);

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file does not exist: ${videoPath}`);
    }

    // DRY RUN MODE
    if (this.dryRun || !pageId || !token) {
      const simulatedId = `sim_video_${pageKey.toLowerCase()}_${Date.now()}`;
      return {
        success: true,
        dryRun: true,
        pageKey,
        pageName: name,
        videoId: simulatedId,
        postId: `${pageId || 'PAGE_ID'}_${simulatedId}`,
        videoPath,
        publishedAt: new Date().toISOString()
      };
    }

    // PRODUCTION MODE: Upload MP4 via graph-video.facebook.com
    const fileBuffer = fs.readFileSync(videoPath);
    const fileName = path.basename(videoPath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });

    const formData = new FormData();
    formData.append('access_token', token);
    if (title) formData.append('title', title);
    formData.append('description', description);
    formData.append('source', blob, fileName);

    const endpoint = `https://graph-video.facebook.com/${this.apiVersion}/${pageId}/videos`;

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (data.error) {
          const isTransient = [1, 2, 4, 17, 341].includes(data.error.code);
          if (isTransient && attempt < retries) {
            attempt++;
            const backoffMs = Math.pow(2, attempt) * 2000;
            console.warn(`[FB Video ${name}] Transient error: ${data.error.message}. Retrying in ${backoffMs}ms...`);
            await new Promise(r => setTimeout(r, backoffMs));
            continue;
          }
          throw new Error(`Facebook Video API Error (${data.error.code}): ${data.error.message}`);
        }

        return {
          success: true,
          dryRun: false,
          pageKey,
          pageName: name,
          videoId: data.id,
          postId: `${pageId}_${data.id}`,
          videoPath,
          publishedAt: new Date().toISOString()
        };
      } catch (err) {
        if (attempt < retries) {
          attempt++;
          const backoffMs = Math.pow(2, attempt) * 2000;
          console.warn(`[FB Video ${name}] Video upload retry in ${backoffMs}ms...`);
          await new Promise(r => setTimeout(r, backoffMs));
        } else {
          throw err;
        }
      }
    }
  }
}

export const fbPublisher = new FacebookPublisher();
