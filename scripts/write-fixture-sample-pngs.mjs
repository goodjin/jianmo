#!/usr/bin/env node
/**
 * 写入多张简单彩色 PNG 到给定目录（无第三方依赖）。
 * 供手工验收文档引用，肉眼区分颜色与占位。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (~c) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(tag, payload) {
  const t = Buffer.from(tag, 'ascii');
  const len = u32be(payload.length);
  const crcIn = Buffer.concat([t, payload]);
  return Buffer.concat([len, t, payload, u32be(crc32(crcIn))]);
}

/** width x height RGBA8888 PNG，纯色矩形 + 左上角 20% 对角条异色便于辨认 */
export function makePngRgb(w, h, r, g, b, stripeR = 255, stripeG = 255, stripeB = 255) {
  const rowSize = w * 4 + 1;
  const raw = Buffer.alloc(rowSize * h);
  let o = 0;
  const band = Math.min(w, h) * 0.45;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const stripe = x + y < band ? 1 : 0;
      raw[o++] = stripe ? stripeR : r;
      raw[o++] = stripe ? stripeG : g;
      raw[o++] = stripe ? stripeB : b;
      raw[o++] = 255;
    }
  }

  const ihdrPayload = Buffer.alloc(13);
  ihdrPayload.writeUInt32BE(w, 0);
  ihdrPayload.writeUInt32BE(h, 4);
  ihdrPayload[8] = 8;
  ihdrPayload[9] = 6;
  ihdrPayload[10] = 0;
  ihdrPayload[11] = 0;
  ihdrPayload[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idatPayload = compressed;
  return Buffer.concat([signature, chunk('IHDR', ihdrPayload), chunk('IDAT', idatPayload), chunk('IEND', Buffer.alloc(0))]);
}

export function ensureFixtureSamplePngs(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const defs = [
    ['exists.png', 120, 60, [40, 120, 200], [230, 250, 255]],
    ['sample-orange.png', 100, 100, [240, 120, 40], [40, 20, 0]],
    ['sample-green.png', 160, 48, [50, 160, 80], [200, 255, 210]],
  ];
  for (const [name, w, h, baseRgb, stripeRgb] of defs) {
    const p = path.join(targetDir, name);
    const png = makePngRgb(w, h, ...baseRgb, ...stripeRgb);
    fs.writeFileSync(p, png);
  }
}
