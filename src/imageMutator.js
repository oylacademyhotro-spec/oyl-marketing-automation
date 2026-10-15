import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Calculates SHA256 hash of a file or buffer
 */
export function getBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return getBufferHash(buf);
}

/**
 * IMAGE MUTATION ENGINE FOR PAGE B
 * Performs:
 * 1. Random 2-3px edge cropping
 * 2. 1% brightness/contrast micro-shift
 * 3. Stripping original metadata and injecting unique Page B metadata
 * 4. Ensures 100% unique cryptographic file hash for Meta duplicate detection bypass
 */
export async function mutateImageForPageB(originalImagePath) {
  if (!fs.existsSync(originalImagePath)) {
    throw new Error(`Original image not found: ${originalImagePath}`);
  }

  const parsed = path.parse(originalImagePath);
  const mutatedPath = path.join(parsed.dir, `${parsed.name}_page_b.png`);

  const image = sharp(originalImagePath);
  const metadata = await image.metadata();

  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Random micro-crop 2-3px
  const cropLeft = Math.floor(Math.random() * 2) + 2; // 2 or 3px
  const cropTop = Math.floor(Math.random() * 2) + 2;
  const cropWidth = width - cropLeft - (Math.floor(Math.random() * 2) + 2);
  const cropHeight = height - cropTop - (Math.floor(Math.random() * 2) + 2);

  // Micro adjustments: 0.99 or 1.01 brightness (1% variation)
  const brightnessMultiplier = Math.random() > 0.5 ? 1.01 : 0.99;
  const saturationMultiplier = Math.random() > 0.5 ? 1.01 : 0.99;

  // Unique salt to guarantee unique binary metadata
  const uniqueSignature = `OYL-PageB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const mutatedBuffer = await sharp(originalImagePath)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight
    })
    .resize(width, height, { fit: 'fill' }) // Resize back to crisp 1080x1080
    .modulate({
      brightness: brightnessMultiplier,
      saturation: saturationMultiplier
    })
    .withMetadata({
      comment: uniqueSignature
    })
    .png({
      compressionLevel: 8,
      adaptiveFiltering: true
    })
    .toBuffer();

  fs.writeFileSync(mutatedPath, mutatedBuffer);

  const origHash = getFileHash(originalImagePath);
  const mutatedHash = getBufferHash(mutatedBuffer);

  return {
    originalPath: originalImagePath,
    mutatedPath: mutatedPath,
    originalHash: origHash,
    mutatedHash: mutatedHash,
    isUnique: origHash !== mutatedHash,
    cropDetails: { cropLeft, cropTop, cropWidth, cropHeight },
    fileSizeBytes: mutatedBuffer.length
  };
}
