import * as zlib from 'node:zlib';

function format(size: number) {
  return Number((size / 1024).toFixed(2));
}

export async function getCompressedSize(outFile: string) {
  const result = await Bun.build({
    entrypoints: [outFile],
    target: 'node',
    format: 'esm',
    packages: 'external',
    external: ['@arfa-tools/generator/api-contract-check/builder'],
    minify: true,
    sourcemap: 'none',
    splitting: false,
    treeShaking: false,
  });

  const minified = new Uint8Array(await result.outputs[0].arrayBuffer());
  const compressed = zlib.brotliCompressSync(minified, {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: minified.length,
  });

  return { minified: format(minified.byteLength), compressed: format(compressed.byteLength) };
}
