import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchCompilers() {
  try {
    const url = 'https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/wasm/list.json';
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to fetch compilers list: ${response.status} ${response.statusText}`);
    const jsonData = await response.text();

    // Determine the target directory relative to this script file
    const targetDir = path.resolve(__dirname, '..', 'public');
    await fs.mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, 'solc-bin-list.json');
    await fs.writeFile(filePath, jsonData, 'utf8');

    console.log(`Compilers list saved to ${filePath}`);
  } catch (error) {
    console.error('Error fetching compilers list:', error);
    process.exit(1);
  }
}

fetchCompilers();
