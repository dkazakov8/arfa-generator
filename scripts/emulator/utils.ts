import fs from 'node:fs';
import path from 'node:path';

export function removeFile(rootDir: string, relativePath: string): void {
  const filePath = path.resolve(rootDir, relativePath);

  if (fs.statSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true });
  } else {
    fs.unlinkSync(filePath);
  }
}

export function writeFile(rootDir: string, relativePath: string, content: string): void {
  const filePath = path.resolve(rootDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
