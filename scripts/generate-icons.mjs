// Generates brand PWA icons (green background + gold "D") as PNGs, with no
// external image libraries — a tiny hand-rolled PNG encoder over Node's zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'public')
mkdirSync(OUT, { recursive: true })

const GREEN = [22, 101, 52] // #166534
const GOLD = [212, 175, 55] // #d4af37

// CRC32 for PNG chunks.
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function drawIcon(size) {
  const s = size
  const px = (v) => v * (s / 512) // scale from a 512 design grid
  const buf = Buffer.alloc(s * s * 4)

  const cx = px(210)
  const cy = px(256)
  const bowlRx = px(150)
  const bowlRy = px(112)
  const innerRx = px(84)
  const innerRy = px(54)
  const stemX0 = px(150)
  const stemX1 = px(212)
  const yTop = px(144)
  const yBot = px(368)

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let col = GREEN
      const inStem = x >= stemX0 && x <= stemX1 && y >= yTop && y <= yBot
      const inBowl =
        y >= yTop &&
        y <= yBot &&
        x >= px(180) &&
        ((x - cx) / bowlRx) ** 2 + ((y - cy) / bowlRy) ** 2 <= 1
      const inCounter = x >= px(180) && ((x - cx) / innerRx) ** 2 + ((y - cy) / innerRy) ** 2 <= 1
      if (inStem || (inBowl && !inCounter)) col = GOLD
      const i = (y * s + x) * 4
      buf[i] = col[0]
      buf[i + 1] = col[1]
      buf[i + 2] = col[2]
      buf[i + 3] = 255
    }
  }
  return buf
}

function encodePNG(size, rgba) {
  const s = size
  // Prefix each scanline with filter byte 0.
  const raw = Buffer.alloc(s * (s * 4 + 1))
  for (let y = 0; y < s; y++) {
    raw[y * (s * 4 + 1)] = 0
    rgba.copy(raw, y * (s * 4 + 1) + 1, y * s * 4, (y + 1) * s * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(s, 0)
  ihdr.writeUInt32BE(s, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const png = encodePNG(size, drawIcon(size))
  writeFileSync(resolve(OUT, `icon-${size}.png`), png)
  console.log(`wrote icon-${size}.png (${png.length} bytes)`)
}
