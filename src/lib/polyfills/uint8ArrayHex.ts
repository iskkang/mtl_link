/**
 * Polyfill for Uint8Array.prototype.toHex / fromHex / setFromHex
 *
 * TC39 Stage-3 proposal (arraybuffer-base64).
 * Native support: Chrome 140+, Firefox 134+, Safari 18.4+
 *
 * Required by pdfjs-dist v5.4+ (hashOriginal.toHex call).
 * See: https://github.com/mozilla/pdf.js/issues/20759
 */

if (typeof Uint8Array.prototype.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    value: function toHex(this: Uint8Array): string {
      let out = ''
      for (let i = 0; i < this.length; i++) {
        out += this[i].toString(16).padStart(2, '0')
      }
      return out
    },
    writable: true,
    configurable: true,
  })
}

if (typeof (Uint8Array as unknown as Record<string, unknown>).fromHex !== 'function') {
  Object.defineProperty(Uint8Array, 'fromHex', {
    value: function fromHex(hex: string): Uint8Array {
      if (typeof hex !== 'string') {
        throw new TypeError('Uint8Array.fromHex: input must be a string')
      }
      if (hex.length % 2 !== 0) {
        throw new SyntaxError('Uint8Array.fromHex: input length must be even')
      }
      const len = hex.length / 2
      const out = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        const byte = parseInt(hex.substr(i * 2, 2), 16)
        if (Number.isNaN(byte)) {
          throw new SyntaxError(`Uint8Array.fromHex: invalid hex at index ${i * 2}`)
        }
        out[i] = byte
      }
      return out
    },
    writable: true,
    configurable: true,
  })
}

if (typeof Uint8Array.prototype.setFromHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'setFromHex', {
    value: function setFromHex(
      this: Uint8Array,
      hex: string,
    ): { read: number; written: number } {
      if (typeof hex !== 'string') {
        throw new TypeError('setFromHex: input must be a string')
      }
      const usableLen = hex.length - (hex.length % 2)
      const maxBytes  = Math.min(usableLen / 2, this.length)
      for (let i = 0; i < maxBytes; i++) {
        const byte = parseInt(hex.substr(i * 2, 2), 16)
        if (Number.isNaN(byte)) {
          throw new SyntaxError(`setFromHex: invalid hex at index ${i * 2}`)
        }
        this[i] = byte
      }
      return { read: maxBytes * 2, written: maxBytes }
    },
    writable: true,
    configurable: true,
  })
}

declare global {
  interface Uint8Array {
    toHex(): string
    setFromHex(hex: string): { read: number; written: number }
  }
  interface Uint8ArrayConstructor {
    fromHex(hex: string): Uint8Array
  }
}

export {}
