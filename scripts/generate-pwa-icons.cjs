const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputFile = path.join(__dirname, '../public/mtl-logo.png');
const outputDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const promises = [];

// Standard icons — white background
sizes.forEach(size => {
  promises.push(
    sharp(inputFile)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(path.join(outputDir, `icon-${size}x${size}.png`))
      .then(() => console.log(`  icon-${size}x${size}.png`))
  );
});

// Maskable icons — dark background (#1e293b) with 10% padding
sizes.forEach(size => {
  const padding = Math.floor(size * 0.1);
  const inner   = size - padding * 2;
  promises.push(
    sharp(inputFile)
      .resize(inner, inner, { fit: 'contain', background: { r: 30, g: 41, b: 59, alpha: 0 } })
      .extend({ top: padding, bottom: padding, left: padding, right: padding,
                background: { r: 30, g: 41, b: 59, alpha: 1 } })
      .png()
      .toFile(path.join(outputDir, `maskable-${size}x${size}.png`))
      .then(() => console.log(`  maskable-${size}x${size}.png`))
  );
});

// Apple Touch Icon (180x180, white bg)
promises.push(
  sharp(inputFile)
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(__dirname, '../public/apple-touch-icon.png'))
    .then(() => console.log('  apple-touch-icon.png'))
);

// Favicons
promises.push(
  sharp(inputFile).resize(32, 32).png()
    .toFile(path.join(__dirname, '../public/favicon-32x32.png'))
    .then(() => console.log('  favicon-32x32.png'))
);
promises.push(
  sharp(inputFile).resize(16, 16).png()
    .toFile(path.join(__dirname, '../public/favicon-16x16.png'))
    .then(() => console.log('  favicon-16x16.png'))
);

Promise.all(promises)
  .then(() => console.log('\nAll icons generated successfully.'))
  .catch(err => { console.error(err); process.exit(1); });
