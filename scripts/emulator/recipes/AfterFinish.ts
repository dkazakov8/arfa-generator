import fs from 'node:fs';

import type { TypeSandboxRecipeConfig } from '../types';

class Codex {
  startThread() {
    return {
      async run(input: string) {
        const filePath = input.match(/^[ \t]*File: (.+)$/m)?.[1];
        const prompt = input.match(/^[ \t]*Task: (.+)$/m)?.[1];

        if (!filePath || !prompt) throw new Error('Expected a file path and a task');

        const responses: Record<string, string> = {
          'create a fibonacci here': `export function fibonacci(n: number): number {
  let previous = 0;
  let current = 1;

  for (let i = 0; i < n; i++) {
    const next = previous + current;

    previous = current;
    current = next;
  }

  return previous;
}
`,
          'modify fibonacci to a recursive function': `export function fibonacci(n: number): number {
  if (n <= 1) return n;

  return fibonacci(n - 1) + fibonacci(n - 2);
}
`,
        };

        const response = responses[prompt];

        if (response === undefined) throw new Error(`No response for: ${prompt}`);

        fs.writeFileSync(filePath, response, 'utf8');

        return { finalResponse: 'Updated the file and removed the // AGENT command.' };
      },
    };
  }
}

export const afterFinishRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'AfterFinish-codex-write',
    title: {
      ru: 'Codex в afterFinish',
      en: '',
    },
    description: {
      ru: 'В watch-режиме при наличии <code>// AGENT</code> в изменённых файлах запускается Codex, который выполняет задачу и удаляет маркер для избежания бесконечного цикла',
      en: '',
    },
    afterFinish:
      () =>
      async ({ changedFiles }) => {
        const codex = new Codex();
        const thread = codex.startThread();

        for (const { absolutePath } of changedFiles || []) {
          const content = fs.readFileSync(absolutePath, 'utf8');
          const prompt = content.match(/\/\/ AGENT (.+)/)?.[1];

          if (!prompt) continue;

          await thread.run(`
            File: ${absolutePath}
            Task: ${prompt}
            Edit the file directly and remove the completed // AGENT command.
          `);
        }
      },
    steps: [
      {
        title: 'Create an empty file',
        files: [
          {
            path: 'fibonacci.ts',
            operation: 'add',
            content: '',
          },
        ],
      },
      {
        title: 'Create a Fibonacci function',
        files: [
          {
            path: 'fibonacci.ts',
            operation: 'change',
            content: '// AGENT create a fibonacci here\n',
          },
        ],
      },
      {
        title: 'Replace it with a recursive function',
        files: [
          {
            path: 'fibonacci.ts',
            operation: 'change',
            content: `// AGENT modify fibonacci to a recursive function
export function fibonacci(n: number): number {
  let previous = 0;
  let current = 1;

  for (let i = 0; i < n; i++) {
    const next = previous + current;

    previous = current;
    current = next;
  }

  return previous;
}
`,
          },
        ],
      },
    ],
  },
];
