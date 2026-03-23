/* eslint-disable @typescript-eslint/naming-convention */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, mock, vi } from 'bun:test';

import { check } from '../../src/api-contract-check/checker';
import { FileGenerator, PluginValidators, type TypeGenerateResult } from '../../src/generator';
import {
  chokidarMock,
  createChangedFile,
  createDeferred,
  getPath,
  rootDir,
  saveMemory,
  setupFileGeneratorTests,
} from './helpers';

const testDir = path.dirname(fileURLToPath(import.meta.url));

const getUserSchema = {
  request: {},
  response: {
    email: 'string',
    name: 'string',
    role: ['union', ['literal', 'manager'], ['literal', 'admin']],
    someData: ['array', ['tuple', 'number', 'string']],
    task: [
      'union',
      {
        status: ['union', ['literal', 0], ['literal', 1], ['literal', 2], ['literal', 3]],
        test: 'string',
        testStow: 'string',
      },
      {
        status: ['union', ['literal', 0], ['literal', 1], ['literal', 2], ['literal', 3]],
        test: 'string',
        testReceiving: 'string',
      },
    ],
  },
} as const;

const getUserExtendedSchema = {
  request: { id: 'string' },
  response: {
    email: 'string',
    gender: 'string',
    name: 'string',
    role: ['union', ['literal', 'manager'], ['literal', 'admin']],
    someData: ['array', ['tuple', 'number', 'string']],
    task: [
      'union',
      {
        status: ['union', ['literal', 0], ['literal', 1], ['literal', 2], ['literal', 3]],
        test: 'string',
        testStow: 'string',
      },
      {
        status: ['union', ['literal', 0], ['literal', 1], ['literal', 2], ['literal', 3]],
        test: 'string',
        testReceiving: 'string',
      },
    ],
  },
} as const;

const validUserResponse = {
  email: 'ada@example.com',
  name: 'Ada',
  role: 'manager',
  someData: [
    [1, 'one'],
    [2, 'two'],
  ],
  task: { status: 2, test: 'scan', testStow: 'bin-a1' },
};

function validatorsFileToSchema(code: string) {
  return JSON.parse(
    code
      .replace(/^\/\/ some-comment\n\n/, '')
      .replace('export default ', '')
      .replace(/ as const;\n?$/, '')
  );
}

const validatorFormatConfig = {
  requestDeclaration: 'TypeRequest',
  responseDeclaration: 'TypeResponse',
  formatContent: ({ schema }: { schema: unknown }) => `export default ${JSON.stringify(schema, null, 2)} as const;`,
};

describe('PluginValidators', () => {
  const secondRootDir = path.resolve(rootDir, '..', 'tmp-2');
  const getSecondPath = (...parts: Array<string>) => path.resolve(secondRootDir, ...parts);
  const targetFolder = getPath('generated');
  const tsconfigPath = path.resolve(testDir, '../../tsconfig.json');
  const baseConfig = {
    entries: ['api'],
    exclude: /(^_.*|package\.json$)/,
    ...validatorFormatConfig,
    targetFolder,
    tsconfigPath,
  };

  const memory = {
    'api/getUser.ts': `import { TypeUser } from '../models/TypeUser';

type TypeRequest = {};

type TypeResponse = TypeUser;

export const getUser: {
  url: string;
  request: TypeRequest;
  response: TypeResponse;
} = {
  url: \`/api/user\`,
  request: {} as TypeRequest,
  response: {} as TypeResponse,
};
`,
    'api/getUserExtended.ts': `import { TypeUserExtended } from '../models/TypeUserExtended';

type TypeRequest = {
  id: string;
};

type TypeResponse = TypeUserExtended;

export const getUserExtended: {
  url: string;
  request: TypeRequest;
  response: TypeResponse;
} = {
  url: \`/api/user/extended\`,
  request: {} as TypeRequest,
  response: {} as TypeResponse,
};
`,
    'models/TypeRole.ts': `export type TypeRole = 'manager' | 'admin';
`,
    'models/TypeTaskStatus.ts': `export type TypeTaskStatus = 0 | 1 | 2 | 3;
`,
    'models/TypeUser.ts': `import { TypeRole } from './TypeRole';
import { TypeTaskAny } from './tasks/TypeTaskAny';

export type TypeUser = {
  email: string;
  name: string;
  task: TypeTaskAny;
  role: TypeRole;
  someData: Array<[number, string]>;
};
`,
    'models/TypeUserExtended.ts': `import { TypeRole } from './TypeRole';
import { TypeUser } from './TypeUser';

export type TypeUserExtended = TypeUser & {
  role: TypeRole;
  gender: string;
};
`,
    'models/tasks/TypeTask.ts': `import { TypeTaskStatus } from '../TypeTaskStatus';

export type TypeTask = {
  test: string;
  status: TypeTaskStatus;
};
`,
    'models/tasks/TypeTaskAny.ts': `import { TypeTaskReceiving } from './TypeTaskReceiving';
import { TypeTaskStow } from './TypeTaskStow';

export type TypeTaskAny = TypeTaskStow | TypeTaskReceiving;
`,
    'models/tasks/TypeTaskReceiving.ts': `import { TypeTask } from './TypeTask';

export type TypeTaskReceiving = TypeTask & {
  testReceiving: string;
};
`,
    'models/tasks/TypeTaskStow.ts': `import { TypeTask } from './TypeTask';

export type TypeTaskStow = TypeTask & {
  testStow: string;
};
`,
  };

  const secondMemory = {
    'api/getUser.ts': memory['api/getUser.ts'],
    'models/TypeRole.ts': memory['models/TypeRole.ts'],
    'models/TypeTaskStatus.ts': memory['models/TypeTaskStatus.ts'],
    'models/TypeUser.ts': memory['models/TypeUser.ts'],
    'models/tasks/TypeTask.ts': memory['models/tasks/TypeTask.ts'],
    'models/tasks/TypeTaskAny.ts': memory['models/tasks/TypeTaskAny.ts'],
    'models/tasks/TypeTaskReceiving.ts': memory['models/tasks/TypeTaskReceiving.ts'],
    'models/tasks/TypeTaskStow.ts': memory['models/tasks/TypeTaskStow.ts'],
  };

  function saveMemory(filesMemory: Record<string, string>, resolver: (...parts: Array<string>) => string) {
    for (const [fileName, content] of Object.entries(filesMemory)) {
      const filePath = resolver(fileName);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }

  const formatSchema = (schema: unknown) => `export default ${JSON.stringify(schema, null, 2)} as const;`;

  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.mkdirSync(secondRootDir, { recursive: true });
    saveMemory(memory, getPath);
    saveMemory(secondMemory, getSecondPath);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.rmSync(secondRootDir, { recursive: true, force: true });
  });

  it('creates validators with api-contract-check schemas and mirrored paths', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    const generatedFiles = await generator.generate({ rootDir, pluginLog, pluginError });
    const generatedByPath = Object.fromEntries(generatedFiles.map((file) => [file.filePath, file]));
    const getSchema = (relativeFilePath: string) =>
      validatorsFileToSchema(generatedByPath[path.resolve(targetFolder, relativeFilePath)]?.rawContent || '');

    expect(generatedFiles).toEqual([
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUser.ts'),
        rawContent: formatSchema(getSchema('api/getUser.ts')),
      },
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUserExtended.ts'),
        rawContent: formatSchema(getSchema('api/getUserExtended.ts')),
      },
    ]);
    expect(generatedFiles.some(({ filePath }) => filePath.includes(`${path.sep}models${path.sep}`))).toBe(false);
    expect(generatedByPath[path.resolve(targetFolder, 'api/getUser.ts')]?.rawContent).toMatch(/^export default /);
    expect(generatedByPath[path.resolve(targetFolder, 'api/getUser.ts')]?.rawContent).toContain(' as const;');
    expect(getSchema('api/getUser.ts')).toEqual(getUserSchema);
    expect(getSchema('api/getUserExtended.ts')).toEqual(getUserExtendedSchema);

    expect(check({ schema: getSchema('api/getUser.ts'), type: 'request', value: {} })).toBeNull();
    expect(
      check({ schema: getSchema('api/getUser.ts'), type: 'response', value: structuredClone(validUserResponse) })
    ).toBeNull();
  });

  it('rebuilds validators when shared model changes after initial generate', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    await generator.generate({ rootDir, pluginLog, pluginError });

    const userModelPath = getPath('models', 'TypeUser.ts');
    const userModelContent = fs.readFileSync(userModelPath, 'utf-8');

    fs.writeFileSync(userModelPath, userModelContent.replace('email: string', 'email: number'), 'utf-8');

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: userModelPath })],
    });
    const generatedByPath = Object.fromEntries(generatedFiles.map((file) => [file.filePath, file]));
    const getSchema = (relativeFilePath: string) =>
      validatorsFileToSchema(generatedByPath[path.resolve(targetFolder, relativeFilePath)]?.rawContent || '');
    const getUserSchemaWithNumberEmail = {
      ...getUserSchema,
      response: { ...getUserSchema.response, email: 'number' },
    };
    const getUserExtendedSchemaWithNumberEmail = {
      ...getUserExtendedSchema,
      response: { ...getUserExtendedSchema.response, email: 'number' },
    };

    expect(generatedFiles).toEqual([
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUser.ts'),
        rawContent: formatSchema(getSchema('api/getUser.ts')),
      },
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUserExtended.ts'),
        rawContent: formatSchema(getSchema('api/getUserExtended.ts')),
      },
    ]);
    expect(getSchema('api/getUser.ts')).toEqual(getUserSchemaWithNumberEmail);
    expect(getSchema('api/getUserExtended.ts')).toEqual(getUserExtendedSchemaWithNumberEmail);
  });

  it('keeps deps per config and rebuilds only affected entry file on direct source change', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([
      { ...baseConfig, exclude: /(^_.*|package\.json$|getUserExtended\.ts$)/ },
      { ...baseConfig, exclude: /(^_.*|package\.json$|getUser\.ts$)/ },
    ]);

    await generator.generate({ rootDir, pluginLog, pluginError });

    const getUserFilePath = getPath('api', 'getUser.ts');
    const getUserFileContent = fs.readFileSync(getUserFilePath, 'utf-8');

    fs.writeFileSync(
      getUserFilePath,
      getUserFileContent.replace('type TypeRequest = {};', 'type TypeRequest = { id: string };'),
      'utf-8'
    );

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: getUserFilePath })],
    });
    const generatedByPath = Object.fromEntries(generatedFiles.map((file) => [file.filePath, file]));
    const getSchema = (relativeFilePath: string) =>
      validatorsFileToSchema(generatedByPath[path.resolve(targetFolder, relativeFilePath)]?.rawContent || '');

    const getUserSchemaWithIdRequest = { ...getUserSchema, request: { id: 'string' } };

    expect(generatedFiles).toEqual([
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUser.ts'),
        rawContent: formatSchema(getSchema('api/getUser.ts')),
      },
    ]);
    expect(getSchema('api/getUser.ts')).toEqual(getUserSchemaWithIdRequest);
  });

  it('returns only remaining validators when source entries shrink on rebuild', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    await generator.generate({ rootDir, pluginLog, pluginError });

    const removedEntryPath = getPath('api', 'getUserExtended.ts');

    fs.unlinkSync(removedEntryPath);

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: removedEntryPath, event: 'unlink' })],
    });

    expect(generatedFiles).toEqual([]);
  });

  it('returns current validator snapshot on first run of a new generator instance', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const firstGenerator = new PluginValidators([{ ...baseConfig }]);

    await firstGenerator.generate({ rootDir, pluginLog, pluginError });

    const secondGenerator = new PluginValidators([{ ...baseConfig }]);

    const generatedFiles = await secondGenerator.generate({
      rootDir: secondRootDir,
      pluginLog,
      pluginError,
    });
    const generatedByPath = Object.fromEntries(generatedFiles.map((file) => [file.filePath, file]));
    const getSchema = (relativeFilePath: string) =>
      validatorsFileToSchema(generatedByPath[path.resolve(targetFolder, relativeFilePath)]?.rawContent || '');

    expect(generatedFiles).toEqual([
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUser.ts'),
        rawContent: formatSchema(getSchema('api/getUser.ts')),
      },
    ]);
    expect(getSchema('api/getUser.ts')).toEqual(getUserSchema);
  });

  it('does not rebuild when changed path equals matched folder path', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    await generator.generate({ rootDir, pluginLog, pluginError });

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: getPath('api') })],
    });

    expect(generatedFiles).toEqual([]);
  });

  it('does not rebuild when changed file is outside entries and has no deps', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    await generator.generate({ rootDir, pluginLog, pluginError });

    const outsideFilePath = getPath('outside.ts');

    fs.writeFileSync(outsideFilePath, 'export const outside = 1;\n', 'utf-8');

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: outsideFilePath })],
    });

    expect(generatedFiles).toEqual([]);
  });

  it('forwards degraded type names to getDegraded callback', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const getDegraded = mock();
    const getUserFilePath = getPath('api', 'getUser.ts');
    const getUserFileContent = fs.readFileSync(getUserFilePath, 'utf-8');
    const generator = new PluginValidators([{ ...baseConfig, getDegraded }]);

    fs.writeFileSync(
      getUserFilePath,
      getUserFileContent.replace('type TypeResponse = TypeUser;', 'type TypeResponse = Promise<string>;'),
      'utf-8'
    );

    const generatedFiles = await generator.generate({ rootDir, pluginLog, pluginError });

    const degradedCalls = getDegraded.mock.calls as Array<[Array<string>]>;

    expect(degradedCalls).toHaveLength(1);
    expect(degradedCalls[0][0]).toContain('TypeResponse');
    const generatedUserFile = generatedFiles.find(
      ({ filePath }) => filePath === path.resolve(targetFolder, 'api/getUser.ts')
    );

    expect(validatorsFileToSchema(generatedUserFile?.rawContent || '').response).toBe('any');
  });

  it('calls getDegraded before failing on degraded union with bailOnDegraded', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const getDegraded = mock();
    const formatContent = mock(baseConfig.formatContent);
    const generator = new PluginValidators([{ ...baseConfig, getDegraded, formatContent, bailOnDegraded: true }]);

    fs.writeFileSync(
      getPath('api', 'getUser.ts'),
      memory['api/getUser.ts'].replace(
        'type TypeResponse = TypeUser;',
        'type TypeResponse = string | Promise<string>;'
      ),
      'utf-8'
    );

    await expect(generator.generate({ rootDir, pluginLog, pluginError })).rejects.toThrow(
      `API contracts degraded to any in "${getPath('api')}": TypeResponse`
    );
    expect(getDegraded).toHaveBeenCalledTimes(1);
    expect(getDegraded).toHaveBeenCalledWith(['TypeResponse']);
    expect(formatContent).not.toHaveBeenCalled();
  });

  it('fails on degradation with bailOnDegraded even without getDegraded', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig, bailOnDegraded: true }]);

    fs.writeFileSync(
      getPath('api', 'getUser.ts'),
      memory['api/getUser.ts'].replace('type TypeResponse = TypeUser;', 'type TypeResponse = Promise<string>;'),
      'utf-8'
    );

    await expect(generator.generate({ rootDir, pluginLog, pluginError })).rejects.toThrow(
      `API contracts degraded to any in "${getPath('api')}": TypeResponse`
    );
  });

  it('generates validators with bailOnDegraded when there are no degradations', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const getDegraded = mock();
    const generator = new PluginValidators([{ ...baseConfig, getDegraded, bailOnDegraded: true }]);

    const generatedFiles = await generator.generate({ rootDir, pluginLog, pluginError });

    expect(generatedFiles).toHaveLength(2);
    expect(generatedFiles.map(({ rawContent }) => validatorsFileToSchema(rawContent))).toEqual([
      getUserSchema,
      getUserExtendedSchema,
    ]);
    expect(getDegraded).not.toHaveBeenCalled();
  });

  it('cleanup returns paths and plugin names for stale target files', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);
    const staleFilePath = path.resolve(targetFolder, 'api/stale.ts');

    fs.mkdirSync(path.dirname(staleFilePath), { recursive: true });
    fs.writeFileSync(staleFilePath, 'stale', 'utf-8');

    const generatedFiles = await generator.generate({ rootDir, pluginLog, pluginError });
    const cleanupFiles = generator.cleanup({ generatedFiles, rootDir });

    expect(cleanupFiles).toEqual([{ plugin: 'validators', filePath: staleFilePath }]);
  });

  it('cleanup returns empty list when all target files are current', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    const generatedFiles = await generator.generate({ rootDir, pluginLog, pluginError });
    const cleanupFiles = generator.cleanup({ generatedFiles, rootDir });

    expect(cleanupFiles).toEqual([]);
  });

  it('rebuilds only getUserExtended when TypeUserExtended model changes', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);
    const userExtendedModelPath = getPath('models', 'TypeUserExtended.ts');
    const userExtendedModelContent = fs.readFileSync(userExtendedModelPath, 'utf-8');

    await generator.generate({ rootDir, pluginLog, pluginError });

    fs.writeFileSync(
      userExtendedModelPath,
      userExtendedModelContent.replace('gender: string;', 'gender: number;'),
      'utf-8'
    );

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: userExtendedModelPath })],
    });
    const generatedByPath = Object.fromEntries(generatedFiles.map((file) => [file.filePath, file]));
    const getSchema = (relativeFilePath: string) =>
      validatorsFileToSchema(generatedByPath[path.resolve(targetFolder, relativeFilePath)]?.rawContent || '');

    expect(generatedFiles).toEqual([
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUserExtended.ts'),
        rawContent: formatSchema(getSchema('api/getUserExtended.ts')),
      },
    ]);
    expect(getSchema('api/getUserExtended.ts')).toEqual({
      ...getUserExtendedSchema,
      response: { ...getUserExtendedSchema.response, gender: 'number' },
    });
  });

  it('passes merged degraded names from multiple entries to getDegraded', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const getDegraded = mock();
    const getUserFilePath = getPath('api', 'getUser.ts');
    const getUserExtendedFilePath = getPath('api', 'getUserExtended.ts');
    const getUserFileContent = fs.readFileSync(getUserFilePath, 'utf-8');
    const getUserExtendedFileContent = fs.readFileSync(getUserExtendedFilePath, 'utf-8');
    const generator = new PluginValidators([{ ...baseConfig, getDegraded }]);

    fs.writeFileSync(
      getUserFilePath,
      getUserFileContent.replace('type TypeResponse = TypeUser;', 'type TypeResponse = Promise<string>;'),
      'utf-8'
    );
    fs.writeFileSync(
      getUserExtendedFilePath,
      getUserExtendedFileContent.replace('type TypeRequest = {\n  id: string;\n};', 'type TypeRequest = Set<string>;'),
      'utf-8'
    );

    await generator.generate({ rootDir, pluginLog, pluginError });

    const degradedCalls = getDegraded.mock.calls as Array<[Array<string>]>;

    expect(degradedCalls).toHaveLength(1);
    expect(degradedCalls[0][0]).toEqual(expect.arrayContaining(['TypeRequest', 'TypeResponse']));
  });

  it('rebuilds newly added api entry on watch add event', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);
    const addedApiFilePath = getPath('api', 'getUserV2.ts');

    fs.writeFileSync(
      addedApiFilePath,
      `import { TypeUser } from '../models/TypeUser';

type TypeRequest = {};

type TypeResponse = TypeUser;

export const getUserV2: {
  url: string;
  request: TypeRequest;
  response: TypeResponse;
} = {
  url: \`/api/user/v2\`,
  request: {} as TypeRequest,
  response: {} as TypeResponse,
};
`,
      'utf-8'
    );

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: addedApiFilePath, event: 'add' })],
    });
    const generatedByPath = Object.fromEntries(generatedFiles.map((file) => [file.filePath, file]));
    const getSchema = (relativeFilePath: string) =>
      validatorsFileToSchema(generatedByPath[path.resolve(targetFolder, relativeFilePath)]?.rawContent || '');

    expect(generatedFiles).toEqual([
      {
        plugin: 'validators',
        filePath: path.resolve(targetFolder, 'api/getUserV2.ts'),
        rawContent: formatSchema(getSchema('api/getUserV2.ts')),
      },
    ]);
    expect(getSchema('api/getUserV2.ts')).toEqual(getUserSchema);
  });

  it('skips rebuild for changed file matched by exclude', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);
    const excludedFilePath = getPath('api', '_internal.ts');

    fs.writeFileSync(
      excludedFilePath,
      `type TypeRequest = {};
type TypeResponse = {};
`,
      'utf-8'
    );

    const generatedFiles = await generator.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: excludedFilePath, event: 'add' })],
    });

    expect(generatedFiles).toEqual([]);
  });

  it('does nothing when changedFiles is empty', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const generator = new PluginValidators([{ ...baseConfig }]);

    expect(generator.generate({ rootDir, pluginLog, pluginError, changedFiles: [] })).resolves.toEqual([]);
  });
});

describe('PluginValidators watch integration', () => {
  setupFileGeneratorTests();

  it('removes only the matching validator when an API source is unlinked', async () => {
    saveMemory({
      'tsconfig.json': JSON.stringify({ include: ['**/*.ts'], compilerOptions: { strict: true } }),
      'api/getOrder.ts': `export type TypeRequest = { id: string };
export type TypeResponse = { id: string };`,
      'api/listOrders.ts': `export type TypeRequest = {};
export type TypeResponse = { ids: Array<string> };`,
    });

    const targetFolder = getPath('validators');
    const generator = new FileGenerator({
      rootDir,
      plugins: [
        new PluginValidators([
          {
            entries: ['api'],
            targetFolder,
            tsconfigPath: getPath('tsconfig.json'),
            requestDeclaration: 'TypeRequest',
            responseDeclaration: 'TypeResponse',
            formatContent: ({ schema }) => `export default ${JSON.stringify(schema)} as const;`,
          },
        ]),
      ],
    });

    await generator.runFullCycle();

    const removedValidatorPath = getPath('validators/api/getOrder.ts');
    const remainingValidatorPath = getPath('validators/api/listOrders.ts');
    const staleValidatorPath = getPath('validators/api/stale.ts');

    expect(fs.existsSync(removedValidatorPath)).toBe(true);
    expect(fs.existsSync(remainingValidatorPath)).toBe(true);

    fs.writeFileSync(staleValidatorPath, 'stale', 'utf-8');

    const finished = createDeferred();
    let result: TypeGenerateResult | undefined;

    await generator.startWatch({
      aggregationTimeout: 5,
      afterFinish: (watchResult) => {
        result = watchResult;
        finished.resolve();
      },
    });

    const removedSourcePath = getPath('api/getOrder.ts');

    fs.unlinkSync(removedSourcePath);
    chokidarMock.watchers.at(-1)?.emit('unlink', removedSourcePath);
    vi.advanceTimersByTime(5);

    await finished.promise;

    expect(fs.existsSync(removedValidatorPath)).toBe(false);
    expect(fs.existsSync(remainingValidatorPath)).toBe(true);
    expect(fs.existsSync(staleValidatorPath)).toBe(true);
    expect(result?.logs.generator).toContainEqual({
      type: 'file:remove',
      plugin: 'validators',
      relativePath: 'validators/api/getOrder.ts',
    });
    expect(result?.logs.generator).toContainEqual(expect.objectContaining({ type: 'phase:end', phase: 'cleanup' }));
  });
});
