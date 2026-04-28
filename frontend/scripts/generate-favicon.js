/**
 * Generate favicon.ico from favicon.svg (blue logo).
 * Run from frontend: node scripts/generate-favicon.js
 */
const path = require('path');
const svgToIco = require('svg-to-ico');

const publicDir = path.join(__dirname, '..', 'public');
const input = path.join(publicDir, 'favicon.svg');
const output = path.join(publicDir, 'favicon.ico');

svgToIco({
  input_name: input,
  output_name: output,
  sizes: [16, 24, 32, 48, 64],
})
  .then(() => console.log('Generated', output))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
