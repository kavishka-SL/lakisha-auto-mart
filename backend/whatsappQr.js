const fs = require('fs');
const QRCode = require('qrcode-terminal/vendor/QRCode');
const errorCorrection = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

function writeQrSvg(value, filePath) {
  const qr = new QRCode(-1, errorCorrection.L);
  qr.addData(value);
  qr.make();

  const margin = 4;
  const dimension = qr.getModuleCount() + margin * 2;
  const cells = [];
  for (let row = 0; row < qr.getModuleCount(); row++) {
    for (let column = 0; column < qr.getModuleCount(); column++) {
      if (qr.isDark(row, column)) cells.push(`M${column + margin} ${row + margin}h1v1h-1z`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 ${dimension} ${dimension}"><rect width="100%" height="100%" fill="white"/><path d="${cells.join('')}" fill="black"/></svg>`;
  fs.writeFileSync(filePath, svg);
}

module.exports = { writeQrSvg };
