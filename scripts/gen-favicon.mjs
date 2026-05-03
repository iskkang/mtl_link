import { readFileSync, writeFileSync } from 'fs'

// Wrap existing 16x16 and 32x32 PNGs into an ICO container.
// Modern browsers accept PNG-compressed ICO images.
const png16 = readFileSync('public/favicon-16x16.png')
const png32 = readFileSync('public/favicon-32x32.png')

const NUM    = 2
const HDR    = 6
const ENTRY  = 16
const OFFSET = HDR + NUM * ENTRY   // 38

const icondir = Buffer.alloc(HDR)
icondir.writeUInt16LE(0, 0)    // reserved
icondir.writeUInt16LE(1, 2)    // type = icon
icondir.writeUInt16LE(NUM, 4)  // count

const e16 = Buffer.alloc(ENTRY)
e16.writeUInt8(16, 0); e16.writeUInt8(16, 1); e16.writeUInt8(0, 2); e16.writeUInt8(0, 3)
e16.writeUInt16LE(1, 4); e16.writeUInt16LE(32, 6)
e16.writeUInt32LE(png16.length, 8)
e16.writeUInt32LE(OFFSET, 12)

const e32 = Buffer.alloc(ENTRY)
e32.writeUInt8(32, 0); e32.writeUInt8(32, 1); e32.writeUInt8(0, 2); e32.writeUInt8(0, 3)
e32.writeUInt16LE(1, 4); e32.writeUInt16LE(32, 6)
e32.writeUInt32LE(png32.length, 8)
e32.writeUInt32LE(OFFSET + png16.length, 12)

const ico = Buffer.concat([icondir, e16, e32, png16, png32])
writeFileSync('public/favicon.ico', ico)
console.log(`favicon.ico created (${ico.length} bytes, contains 16×16 + 32×32 PNG)`)
