// Generates public/icon-192.png and public/icon-512.png
// Solid #09090b square — matches the manifest background_color
// Run once: node scripts/generate-icons.mjs

import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

function buildPNG(size, r, g, b) {
  const channels = 3;
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * channels);
    row[0] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      row[1 + x * channels] = r;
      row[2 + x * channels] = g;
      row[3 + x * channels] = b;
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = deflateSync(raw);

  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;       // bit depth
  ihdrData[9] = 2;       // color type: RGB
  ihdrData[10] = 0;      // compression
  ihdrData[11] = 0;      // filter
  ihdrData[12] = 0;      // interlace

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// #09090b = rgb(9, 9, 11)
const png192 = buildPNG(192, 9, 9, 11);
const png512 = buildPNG(512, 9, 9, 11);

writeFileSync("public/icon-192.png", png192);
writeFileSync("public/icon-512.png", png512);

console.log("Created public/icon-192.png and public/icon-512.png");
