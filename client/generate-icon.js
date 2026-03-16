// Simple icon generator for Tauri
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a simple 256x256 PNG with a blue circle
function createSimplePng(size) {
  const width = size;
  const height = size;
  
  // Create raw pixel data (RGBA)
  const pixels = Buffer.alloc(width * height * 4);
  
  // Fill with design
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const centerX = width / 2;
      const centerY = height / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const radius = width * 0.4;
      
      if (dist < radius) {
        // White inner circle
        pixels[idx] = 0xFF;
        pixels[idx + 1] = 0xFF;
        pixels[idx + 2] = 0xFF;
        pixels[idx + 3] = 0xFF;
      } else if (dist < radius + width * 0.08) {
        // Blue ring (#2563EB)
        pixels[idx] = 0x25;
        pixels[idx + 1] = 0x63;
        pixels[idx + 2] = 0xEB;
        pixels[idx + 3] = 0xFF;
      } else {
        // Transparent
        pixels[idx] = 0x00;
        pixels[idx + 1] = 0x00;
        pixels[idx + 2] = 0x00;
        pixels[idx + 3] = 0x00;
      }
    }
  }
  
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // bit depth
  ihdrData.writeUInt8(6, 9);  // color type (RGBA)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdr = createChunk('IHDR', ihdrData);
  
  // IDAT chunk
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0;
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  
  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create ICO file from PNG buffers
function createIco(pngBuffers) {
  // ICO header: 2 bytes reserved, 2 bytes type (1=ICO), 2 bytes image count
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: 1 = ICO
  header.writeUInt16LE(pngBuffers.length, 4);  // Number of images
  
  // Directory entries (16 bytes each)
  const entries = [];
  let offset = 6 + (pngBuffers.length * 16);
  
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // Width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // Height
    entry.writeUInt8(0, 2);    // Color palette
    entry.writeUInt8(0, 3);    // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8);  // Size of image data
    entry.writeUInt32LE(offset, 12);        // Offset to image data
    entries.push(entry);
    offset += buffer.length;
  }
  
  // Combine all parts
  const parts = [header, ...entries, ...pngBuffers.map(p => p.buffer)];
  return Buffer.concat(parts);
}

async function main() {
  const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
  
  // Create PNGs of different sizes
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = sizes.map(size => ({
    size,
    buffer: createSimplePng(size)
  }));
  
  // Save 256x256 PNG
  const pngPath = path.join(iconsDir, 'icon.png');
  fs.writeFileSync(pngPath, pngBuffers[0].buffer);
  console.log('Created:', pngPath);
  
  // Create ICO with multiple sizes
  const icoBuffer = createIco(pngBuffers);
  const icoPath = path.join(iconsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Created:', icoPath);
  
  console.log('Icon generation complete!');
}

main();
