const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcRenderer = path.join(root, 'src', 'renderer');
const distRenderer = path.join(root, 'dist', 'renderer');

const filesToCopy = ['index.html', 'styles.css'];

if (!fs.existsSync(distRenderer)) {
  fs.mkdirSync(distRenderer, { recursive: true });
}

filesToCopy.forEach((fileName) => {
  const sourceFile = path.join(srcRenderer, fileName);
  const targetFile = path.join(distRenderer, fileName);

  if (!fs.existsSync(sourceFile)) {
    console.error(`Arquivo não encontrado: ${sourceFile}`);
    process.exit(1);
  }

  fs.copyFileSync(sourceFile, targetFile);
  console.log(`Copiado: ${sourceFile} -> ${targetFile}`);
});
