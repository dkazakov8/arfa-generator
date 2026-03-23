import fs from 'node:fs';
import path from 'node:path';

import type { TypeChangedFile, TypeFilePath, TypeGeneratorLog } from '../types';

export function resolveFilePaths(rootDir: string, paths: Set<string>, exists = true): Array<TypeFilePath> {
  return [...paths]
    .map((relativePath) => ({
      relativePath,
      absolutePath: path.resolve(rootDir, relativePath),
    }))
    .filter(({ absolutePath }) => fs.existsSync(absolutePath) === exists);
}

export function excludeCascadeChanges(
  files: Array<TypeChangedFile>,
  logs: Array<TypeGeneratorLog>
): Array<TypeChangedFile> {
  const cascadeFiles = logs.flatMap((log) =>
    log.type === 'iteration:start'
      ? (log.changedFiles ?? []).filter((file) => file.origin === 'cascade' && file.event !== 'unlink')
      : []
  );

  return files.filter(
    (file) =>
      !cascadeFiles.some(
        (cascadeFile) =>
          cascadeFile.filePath === file.filePath &&
          cascadeFile.event === file.event &&
          cascadeFile.eventTimeMs === file.eventTimeMs
      )
  );
}

export function createChangedFile(
  rootDir: string,
  partialData: Omit<TypeChangedFile, 'relativePath' | 'eventTimeMs'> & { eventTimeMs?: number }
): TypeChangedFile {
  const { event, origin, filePath, eventTimeMs } = partialData;

  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
  const relativePath = path.relative(rootDir, absPath).replace(/\\/g, '/');

  return {
    event,
    origin,
    filePath: absPath,
    relativePath,
    eventTimeMs: eventTimeMs ?? performance.timeOrigin + performance.now(),
  };
}

export function resolveInsideRootDir(
  rootDir: string,
  params: { filePath: string; action: 'write' | 'remove' }
): string {
  const { filePath, action } = params;

  const absPath = path.resolve(rootDir, filePath);
  const rootRelativePath = path.relative(rootDir, absPath).replace(/\\/g, '/');
  const resolveRealPath = (targetPath: string): string => {
    let existingPath = targetPath;

    while (!fs.existsSync(existingPath)) existingPath = path.dirname(existingPath);

    return path.resolve(fs.realpathSync(existingPath), path.relative(existingPath, targetPath));
  };

  const realRootDir = resolveRealPath(path.resolve(rootDir));
  const realPath =
    action === 'remove'
      ? path.resolve(resolveRealPath(path.dirname(absPath)), path.basename(absPath))
      : resolveRealPath(absPath);
  const realRelativePath = path.relative(realRootDir, realPath).replace(/\\/g, '/');
  const isInsideRootDir =
    !rootRelativePath.startsWith('../') &&
    rootRelativePath !== '..' &&
    !realRelativePath.startsWith('../') &&
    realRelativePath !== '..';

  if (!isInsideRootDir) throw new Error(`Cannot ${action} file outside rootDir: ${filePath}`);

  return absPath;
}
