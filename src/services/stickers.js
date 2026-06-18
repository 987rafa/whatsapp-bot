const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const TEMP = path.join(__dirname, '../../data/temp');
fs.mkdirSync(TEMP, { recursive: true });

async function imageToSticker(sock, msg) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: undefined });
    if (!buffer) return null;

    const inputPath = path.join(TEMP, `sticker_in_${Date.now()}.webp`);
    const outputPath = path.join(TEMP, `sticker_out_${Date.now()}.webp`);

    fs.writeFileSync(inputPath, buffer);

    await sharp(inputPath)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const stickerBuffer = fs.readFileSync(outputPath);

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    return stickerBuffer;
  } catch (err) {
    console.error('Sticker error:', err.message);
    return null;
  }
}

module.exports = { imageToSticker };
