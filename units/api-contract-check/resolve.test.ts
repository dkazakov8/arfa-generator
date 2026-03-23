import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { createTsProjectResolution, createValidators } from '../../src/api-contract-check/builder';
import type { TypeRootSchema } from '../../src/api-contract-check/types';
import { getTsModuleSpecifier, readTsConfig } from '../../src/api-contract-check/typescriptProject';
import { cases, getTestTmpDir, prepare } from './helpers';

const tmpDir = getTestTmpDir(path.resolve(process.cwd(), 'units/api-contract-check'));
const tsconfigPath = path.resolve(`${tmpDir}/tsconfig.json`);

const filePath = {
  userApi: path.resolve(`${tmpDir}/src/contracts/userApi.ts`),
  identity: path.resolve(`${tmpDir}/src/shared/identity.ts`),
  user: path.resolve(`${tmpDir}/src/models/user.ts`),
  profile: path.resolve(`${tmpDir}/src/models/profile.ts`),
  index: path.resolve(`${tmpDir}/src/models/index.ts`),
  index2: path.resolve(`${tmpDir}/src/models/index2.ts`),
} as const;

const tsconfigContent = `{
  "compilerOptions": {
    "rootDir": "src",
    "paths": {
      "src/*": ["src/*"],
      "*": ["src/*"],
      "@contracts/*": ["src/contracts/*"],
      "@models/*": ["src/models/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
`;

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(tsconfigPath, tsconfigContent);
});

afterEach(() => {
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

const memory: Record<string, string> = {
  [filePath.userApi]: `import type { TypeUser } from '@models/user';

export type TypeRequest = TypeUser;
export type TypeResponse = TypeUser;
`,
  [filePath.identity]: `export type TypeId = number;
`,
  [filePath.user]: `import type { TypeProfile } from '@models/profile';
import type { TypeId } from '@shared/identity';

export interface TypeUser {
  id: TypeId;
  profile: TypeProfile;
}
`,
  [filePath.profile]: `export interface TypeProfile {
  name: string;
  age: number;
}
`,
  [filePath.index]: `export type { TypeUser } from './user';
`,
  [filePath.index2]: `export * from './user';
`,
};

describe('Resolution logic', () => {
  it('reports missing contract declarations and unresolved imports', () => {
    const missingAllPath = '/virtual/missingContract.ts';
    const missingResponsePath = '/virtual/missingResponse.ts';
    const missingRequestPath = '/virtual/missingRequest.ts';
    const missingEntryPath = '/virtual/missingEntry.ts';
    const unresolvedImportPath = '/virtual/unresolvedImport.ts';

    const errorMemory: Record<string, string> = {
      [missingAllPath]: `export interface IUser { name: string; }`,
      [missingResponsePath]: `type TypeRequest = string;`,
      [missingRequestPath]: `type TypeResponse = string;`,
      [unresolvedImportPath]: `import { User } from "./missing"; type TypeRequest = User; type TypeResponse = User;`,
    };
    const options = prepare('memory', errorMemory, tsconfigPath);

    expect(() => createValidators([missingAllPath], options)).toThrow(
      `Entry file "${missingAllPath}" must declare both TypeRequest and TypeResponse`
    );

    expect(() => createValidators([missingResponsePath], options)).toThrow(
      `Entry file "${missingResponsePath}" must declare TypeResponse`
    );

    expect(() => createValidators([missingRequestPath], options)).toThrow(
      `Entry file "${missingRequestPath}" must declare TypeRequest`
    );

    expect(() => createValidators([missingEntryPath], options)).toThrow(
      `Failed to read source file "${missingEntryPath}"`
    );

    expect(() => createValidators([unresolvedImportPath], options)).toThrow(
      `Failed to resolve import "./missing" from "${unresolvedImportPath}"`
    );
  });

  it('reports a generic contract error when no entry declares a full contract', () => {
    const firstPath = '/virtual/missingFirst.ts';
    const secondPath = '/virtual/missingSecond.ts';
    const options = prepare(
      'memory',
      {
        [firstPath]: `export interface First { id: string; }`,
        [secondPath]: `export interface Second { id: string; }`,
      },
      tsconfigPath
    );

    expect(() => createValidators([firstPath, secondPath], options)).toThrow(
      'Expected at least one input entry file to declare both TypeRequest and TypeResponse'
    );
  });

  it('rejects relative input paths', () => {
    const options = prepare('memory', {}, tsconfigPath);

    expect(() => createValidators(['src/api/getUser.ts'], options)).toThrow(
      'Input file path must be absolute: src/api/getUser.ts'
    );
  });

  it('rejects empty configured root declaration names', () => {
    const customFilePath = '/virtual/missingConfiguredDeclarationNames.ts';
    const options = prepare(
      'memory',
      {
        [customFilePath]: `type TypeRequest = string; type TypeResponse = string;`,
      },
      tsconfigPath
    );

    expect(() =>
      createValidators([customFilePath], {
        ...options,
        requestDeclaration: '',
      })
    ).toThrow('Missing requestDeclaration option');

    expect(() =>
      createValidators([customFilePath], {
        ...options,
        responseDeclaration: '',
      })
    ).toThrow('Missing responseDeclaration option');
  });

  it('prefers memory reads before falling back to disk reads', () => {
    const memoryFilePath = path.resolve(`${tmpDir}/memoryOnly.ts`);
    const diskFilePath = path.resolve(`${tmpDir}/diskOnly.ts`);
    const memoryContent = `export type MemoryOnly = string;`;
    const diskContent = `export type DiskOnly = string;`;

    fs.writeFileSync(diskFilePath, diskContent);

    const context = createTsProjectResolution({
      allowNoInputs: true,
      readFile: (candidatePath) => (candidatePath === memoryFilePath ? memoryContent : undefined),
      tsconfigPath,
    });

    expect(context.host.fileExists(memoryFilePath)).toBe(true);
    expect(context.host.readFile(memoryFilePath)).toBe(memoryContent);
    expect(context.host.fileExists(diskFilePath)).toBe(true);
    expect(context.host.readFile(diskFilePath)).toBe(diskContent);
  });

  it('reads each virtual dependency once', () => {
    const entryPath = path.resolve(`${tmpDir}/src/contracts/readOnce.ts`);
    const dependencyPath = path.resolve(`${tmpDir}/src/models/readOnce.ts`);
    const memory: Record<string, string> = {
      [entryPath]: `
        import type { TypeValue } from '../models/readOnce';

        type TypeRequest = TypeValue;
        type TypeResponse = TypeValue;
      `,
      [dependencyPath]: `export type TypeValue = { id: string };`,
    };
    let dependencyReadCount = 0;

    createValidators([entryPath], {
      ...prepare('memory', memory, tsconfigPath),
      readFile: (candidatePath) => {
        if (candidatePath === dependencyPath) dependencyReadCount++;

        return memory[candidatePath];
      },
    });

    expect(dependencyReadCount).toBe(1);
  });

  it('throws tsconfig diagnostics unless no-input errors are allowed', () => {
    const malformedTsconfigPath = path.resolve(`${tmpDir}/malformed-tsconfig.json`);

    fs.writeFileSync(malformedTsconfigPath, `{`);

    expect(() => readTsConfig(malformedTsconfigPath)).toThrow();
    expect(() => readTsConfig(tsconfigPath)).toThrow('No inputs were found in config file');
    expect(readTsConfig(tsconfigPath, { allowNoInputs: true }).fileNames).toEqual([]);
  });

  it('extracts module sources from import type and dynamic import nodes', () => {
    const sourceFile = ts.createSourceFile(
      '/virtual/moduleSources.ts',
      `
        import type { User } from './user';
        export type { Profile } from './profile';
        type Lazy = import('./lazy').Lazy;
        const runtime = import('./runtime');
        const runtimeWithOptions = import('./runtime-json', { with: { type: 'json' } });
        const notModule = require('./ignored');
      `,
      ts.ScriptTarget.Latest,
      true
    );
    const sources: Array<string | null> = [];

    const visit = (node: ts.Node) => {
      const source = getTsModuleSpecifier(node);
      if (source) sources.push(source);
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    expect(sources).toEqual(['./user', './profile', './lazy', './runtime', './runtime-json']);
    expect(getTsModuleSpecifier(sourceFile.statements[5])).toBeNull();
  });

  describe.each(cases)('Source loading and tsconfig aliases (%s)', (mode) => {
    it('loads transitive imports through tsconfig path aliases', () => {
      const expectedDeps = {
        [filePath.profile]: [filePath.userApi],
        [filePath.user]: [filePath.userApi],
        [filePath.identity]: [filePath.userApi],
      };

      const memoryWithStringIdentity: Record<string, string> = {
        ...memory,
        [filePath.identity]: `export type TypeId = string;`,
      };

      const loadingCases: Array<{ memory: Record<string, string>; schema: TypeRootSchema }> = [
        {
          memory,
          schema: {
            request: { id: 'number', profile: { name: 'string', age: 'number' } },
            response: { id: 'number', profile: { name: 'string', age: 'number' } },
          },
        },
        {
          memory: memoryWithStringIdentity,
          schema: {
            request: { id: 'string', profile: { name: 'string', age: 'number' } },
            response: { id: 'string', profile: { name: 'string', age: 'number' } },
          },
        },
      ];

      for (const { memory, schema } of loadingCases) {
        const options = prepare(mode, memory, tsconfigPath);
        const { deps, result } = createValidators([filePath.userApi], options);
        const { filePath: resultFilePath, schema: resultSchema } = result[0];

        expect(result).toHaveLength(1);
        expect(resultFilePath).toBe(filePath.userApi);
        expect(resultSchema).toEqual(schema);
        expect(deps).toEqual(expectedDeps);
      }
    });
  });

  it('builds schemas from configured root declaration names', () => {
    const customFilePath = '/virtual/customDeclarationNames.ts';
    const source = `
      type ApiRequest = { id: string; };
      type ApiResponse = { ok: boolean; };
    `;
    const memory: Record<string, string> = {
      [customFilePath]: source,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([customFilePath], {
      ...options,
      requestDeclaration: 'ApiRequest',
      responseDeclaration: 'ApiResponse',
    });

    expect(schema).toEqual({ request: { id: 'string' }, response: { ok: 'boolean' } });
  });

  it('builds schemas from non-exported local root declarations', () => {
    const localRootFilePath = '/virtual/localRootDeclarations.ts';
    const memory: Record<string, string> = {
      [localRootFilePath]: `
        type TypeRequest = { id: string; };
        interface TypeResponse {
          ok: boolean;
        }
      `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([localRootFilePath], options);

    expect(schema).toEqual({ request: { id: 'string' }, response: { ok: 'boolean' } });
  });

  describe.each(cases)('Inverse dependencies (%s)', (mode) => {
    it('normalizes absolute paths and keeps deps unchanged when a dependency is also an input', () => {
      const entryInputPath = `${tmpDir}/src/contracts/../contracts/absolutePaths.ts`;
      const dependencyInputPath = `${tmpDir}/src/models/../models/absolutePaths.ts`;
      const entryPath = path.resolve(entryInputPath);
      const dependencyPath = path.resolve(dependencyInputPath);
      const memory: Record<string, string> = {
        [entryPath]: `
          import type { TypeUser } from '../models/absolutePaths';

          type TypeRequest = TypeUser;
          type TypeResponse = TypeUser;
        `,
        [dependencyPath]: `export type TypeUser = { id: string };`,
      };
      const options = prepare(mode, memory, tsconfigPath);

      const initial = createValidators([entryInputPath], options);
      const withDependency = createValidators([entryInputPath, dependencyInputPath], options);

      expect(initial.result).toEqual([
        { filePath: entryPath, schema: { request: { id: 'string' }, response: { id: 'string' } } },
      ]);
      expect(initial.deps).toEqual({ [dependencyPath]: [entryPath] });
      expect(withDependency.result).toEqual(initial.result);
      expect(withDependency.deps).toEqual(initial.deps);
    });

    it('tracks default, namespace, side-effect imports and namespace re-exports through cycles', () => {
      const entryPath = path.resolve(`${tmpDir}/src/contracts/entry.ts`);
      const defaultPath = path.resolve(`${tmpDir}/src/models/default.ts`);
      const namespacePath = path.resolve(`${tmpDir}/src/models/namespace.ts`);
      const setupPath = path.resolve(`${tmpDir}/src/models/setup.ts`);
      const reexportPath = path.resolve(`${tmpDir}/src/models/reexport.ts`);
      const nestedPath = path.resolve(`${tmpDir}/src/models/nested.ts`);
      const memory: Record<string, string> = {
        [entryPath]: `
          import DefaultValue from '../models/default';
          import * as Namespace from '../models/namespace';
          import '../models/setup';
          import '../models/setup';
          export * as Reexported from '../models/reexport';

          type TypeRequest = { id: string };
          type TypeResponse = boolean;
        `,
        [defaultPath]: `import './nested'; export default 1;`,
        [namespacePath]: `import './nested'; export type TypeValue = number;`,
        [setupPath]: `import './nested';`,
        [reexportPath]: `import './nested'; export type TypeValue = boolean;`,
        [nestedPath]: `import '../contracts/entry';`,
      };
      const options = prepare(mode, memory, tsconfigPath);

      const { deps, result } = createValidators([entryPath], options);

      expect(result).toEqual([{ filePath: entryPath, schema: { request: { id: 'string' }, response: 'boolean' } }]);
      expect(deps).toEqual({
        [defaultPath]: [entryPath],
        [namespacePath]: [entryPath],
        [nestedPath]: [entryPath],
        [reexportPath]: [entryPath],
        [setupPath]: [entryPath],
      });
    });

    it('tracks dependencies shared by multiple entries and used by one entry', () => {
      const entryAPath = path.resolve(`${tmpDir}/src/contracts/entryA.ts`);
      const entryBPath = path.resolve(`${tmpDir}/src/contracts/entryB.ts`);
      const sharedPath = path.resolve(`${tmpDir}/src/models/shared.ts`);
      const onlyBPath = path.resolve(`${tmpDir}/src/models/onlyB.ts`);
      const nestedPath = path.resolve(`${tmpDir}/src/models/nested.ts`);
      const memory: Record<string, string> = {
        [entryAPath]: `
          import type { Shared } from '../models/shared';

          type TypeRequest = Shared;
          type TypeResponse = Shared;
        `,
        [entryBPath]: `
          import type { Shared } from '../models/shared';
          import type { OnlyB } from '../models/onlyB';

          type TypeRequest = Shared & OnlyB;
          type TypeResponse = Shared;
        `,
        [sharedPath]: `
          import type { Nested } from './nested';

          export type Shared = { id: string; nested: Nested };
        `,
        [onlyBPath]: `
          import type { Nested } from './nested';

          export type OnlyB = { flag: boolean; nested: Nested };
        `,
        [nestedPath]: `export type Nested = { label: string };`,
      };
      const options = prepare(mode, memory, tsconfigPath);

      const { deps, result } = createValidators([entryAPath, entryBPath], options);

      expect(result.map((it) => it.schema)).toEqual([
        {
          request: { id: 'string', nested: { label: 'string' } },
          response: { id: 'string', nested: { label: 'string' } },
        },
        {
          request: { id: 'string', nested: { label: 'string' }, flag: 'boolean' },
          response: { id: 'string', nested: { label: 'string' } },
        },
      ]);
      expect(deps).toEqual({
        [nestedPath]: [entryAPath, entryBPath],
        [onlyBPath]: [entryBPath],
        [sharedPath]: [entryAPath, entryBPath],
      });
    });
  });

  describe.each(cases)('Barrel re-exports (%s)', (mode) => {
    it('does not expose other names through named or namespace re-exports', () => {
      const entryPath = path.resolve(`${tmpDir}/src/contracts/entry.ts`);
      const barrelPath = path.resolve(`${tmpDir}/src/models/barrel.ts`);
      const typesPath = path.resolve(`${tmpDir}/src/models/types.ts`);
      const memory: Record<string, string> = {
        [entryPath]: `
          import type { TypeVisible, TypePublic, TypeHidden } from '../models/barrel';

          type TypeRequest = TypeVisible;
          type TypeResponse = { original: TypePublic; hidden: TypeHidden };
        `,
        [barrelPath]: `
          export { TypePublic as TypeVisible } from './types';
          export * as Types from './types';
        `,
        [typesPath]: `
          export type TypePublic = { id: string };
          export type TypeHidden = boolean;
        `,
      };
      const getDegraded = mock();
      const options = prepare(mode, memory, tsconfigPath);

      const { deps, result } = createValidators([entryPath], { ...options, getDegraded });

      expect(result).toEqual([
        {
          filePath: entryPath,
          schema: { request: { id: 'string' }, response: { original: 'any', hidden: 'any' } },
        },
      ]);
      expect(getDegraded).toHaveBeenCalledWith(['hidden', 'original']);
      expect(deps).toEqual({ [barrelPath]: [entryPath], [typesPath]: [entryPath] });
    });

    it('uses star exports for missing names while preferring explicit re-export aliases', () => {
      const entryPath = path.resolve(`${tmpDir}/src/contracts/entry.ts`);
      const barrelPath = path.resolve(`${tmpDir}/src/models/barrel.ts`);
      const namedPath = path.resolve(`${tmpDir}/src/models/named.ts`);
      const starPath = path.resolve(`${tmpDir}/src/models/star.ts`);
      const memory: Record<string, string> = {
        [entryPath]: `
          import type { TypeVisible, TypeHidden } from '../models/barrel';

          type TypeRequest = TypeVisible;
          type TypeResponse = TypeHidden;
        `,
        [barrelPath]: `
          export { TypePublic as TypeVisible } from './named';
          export * from './star';
        `,
        [namedPath]: `
          export type TypePublic = { id: string };
          export type TypeHidden = string;
        `,
        [starPath]: `
          export type TypeVisible = boolean;
          export type TypeHidden = number;
        `,
      };
      const getDegraded = mock();
      const options = prepare(mode, memory, tsconfigPath);

      const { deps, result } = createValidators([entryPath], { ...options, getDegraded });

      expect(result).toEqual([{ filePath: entryPath, schema: { request: { id: 'string' }, response: 'number' } }]);
      expect(getDegraded).not.toHaveBeenCalled();
      expect(deps).toEqual({
        [barrelPath]: [entryPath],
        [namedPath]: [entryPath],
        [starPath]: [entryPath],
      });
    });

    it('uses barrel re-exports for imported types but keeps root declarations local', () => {
      const entryFilePath = path.resolve(`${tmpDir}/src/contracts/localRootsWithBarrel.ts`);
      const barrelPath = path.resolve(`${tmpDir}/src/models/barrel.ts`);
      const payloadPath = path.resolve(`${tmpDir}/src/models/payload.ts`);
      const memoryWithBarrel: Record<string, string> = {
        [entryFilePath]: `
          import type { Payload } from '../models/barrel';

          type TypeRequest = Payload;
          type TypeResponse = { ok: boolean };
        `,
        [barrelPath]: `export * from './payload';`,
        [payloadPath]: `export type Payload = { id: string };`,
      };
      const options = prepare(mode, memoryWithBarrel, tsconfigPath);

      const {
        deps,
        result: [{ schema }],
      } = createValidators([entryFilePath], options);

      expect(schema).toEqual({ request: { id: 'string' }, response: { ok: 'boolean' } });
      expect(deps).toEqual({ [barrelPath]: [entryFilePath], [payloadPath]: [entryFilePath] });
    });

    it('resolves aliased imports', () => {
      const aliasImportFilePath = path.resolve(`${tmpDir}/src/contracts/aliasImport.ts`);
      const payloadFilePath = path.resolve(`${tmpDir}/src/models/payload.ts`);
      const memoryWithImportAlias: Record<string, string> = {
        ...memory,
        [aliasImportFilePath]: `import type { Payload as ContractPayload } from '../models/payload';

export type TypeRequest = ContractPayload;
export type TypeResponse = ContractPayload;
`,
        [payloadFilePath]: `export type Payload = { id: string; };
`,
      };

      const options = prepare(mode, memoryWithImportAlias, tsconfigPath);
      const {
        deps,
        result: [{ schema }],
      } = createValidators([aliasImportFilePath], options);

      expect(schema).toEqual({ request: { id: 'string' }, response: { id: 'string' } });
      expect(deps).toEqual({ [payloadFilePath]: [aliasImportFilePath] });
    });

    it('resolves aliased barrel re-exports', () => {
      for (const barrelImport of ['@models/index', '@models/index2', '../models', 'src/models', 'models'] as const) {
        const memoryWithBarrelEntry: Record<string, string> = {
          ...memory,
          [filePath.userApi]: `import type { TypeUser } from '${barrelImport}'; export type TypeRequest = TypeUser; export type TypeResponse = TypeUser;`,
        };

        const options = prepare(mode, memoryWithBarrelEntry, tsconfigPath);
        const { deps, result } = createValidators([filePath.userApi], options);
        const { filePath: resultFilePath, schema } = result[0];

        expect(result).toHaveLength(1);
        expect(resultFilePath).toBe(filePath.userApi);
        expect(schema).toEqual({
          request: { id: 'number', profile: { name: 'string', age: 'number' } },
          response: { id: 'number', profile: { name: 'string', age: 'number' } },
        });

        expect(deps).toEqual({
          [barrelImport === '@models/index2' ? filePath.index2 : filePath.index]: [filePath.userApi],
          [filePath.profile]: [filePath.userApi],
          [filePath.user]: [filePath.userApi],
          [filePath.identity]: [filePath.userApi],
        });
      }
    });

    it('resolves local export aliases from barrels', () => {
      const aliasFilePath = path.resolve(`${tmpDir}/src/models/alias.ts`);
      const memoryWithLocalAlias: Record<string, string> = {
        ...memory,
        [filePath.userApi]: `import type { UserContract } from '@models/alias';

export type TypeRequest = UserContract;
export type TypeResponse = UserContract;
`,
        [aliasFilePath]: `import type { TypeUser } from './user';

export { TypeUser as UserContract };
`,
      };

      const options = prepare(mode, memoryWithLocalAlias, tsconfigPath);
      const {
        deps,
        result: [{ schema }],
      } = createValidators([filePath.userApi], options);

      expect(schema).toEqual({
        request: { id: 'number', profile: { name: 'string', age: 'number' } },
        response: { id: 'number', profile: { name: 'string', age: 'number' } },
      });
      expect(deps).toEqual({
        [aliasFilePath]: [filePath.userApi],
        [filePath.profile]: [filePath.userApi],
        [filePath.user]: [filePath.userApi],
        [filePath.identity]: [filePath.userApi],
      });
    });

    it('resolves local export aliases with renamed symbols', () => {
      const aliasFilePath = path.resolve(`${tmpDir}/src/models/localAlias.ts`);
      const memoryWithRenamedLocalAlias: Record<string, string> = {
        ...memory,
        [filePath.userApi]: `import type { UserContract } from '@models/localAlias';

export type TypeRequest = UserContract;
export type TypeResponse = UserContract;
`,
        [aliasFilePath]: `import type { TypeUser } from './user';

type InternalUser = TypeUser;
export { InternalUser as UserContract };
`,
      };

      const options = prepare(mode, memoryWithRenamedLocalAlias, tsconfigPath);
      const {
        deps,
        result: [{ schema }],
      } = createValidators([filePath.userApi], options);

      expect(schema).toEqual({
        request: { id: 'number', profile: { name: 'string', age: 'number' } },
        response: { id: 'number', profile: { name: 'string', age: 'number' } },
      });
      expect(deps).toEqual({
        [aliasFilePath]: [filePath.userApi],
        [filePath.profile]: [filePath.userApi],
        [filePath.user]: [filePath.userApi],
        [filePath.identity]: [filePath.userApi],
      });
    });

    it('resolves named re-export aliases from barrels', () => {
      const aliasFilePath = path.resolve(`${tmpDir}/src/models/alias.ts`);
      const memoryWithReExportAlias: Record<string, string> = {
        ...memory,
        [filePath.userApi]: `import type { UserContract } from '@models/alias';

export type TypeRequest = UserContract;
export type TypeResponse = UserContract;
`,
        [aliasFilePath]: `export { TypeUser as UserContract } from './user';
`,
      };

      const options = prepare(mode, memoryWithReExportAlias, tsconfigPath);
      const {
        deps,
        result: [{ schema }],
      } = createValidators([filePath.userApi], options);

      expect(schema).toEqual({
        request: { id: 'number', profile: { name: 'string', age: 'number' } },
        response: { id: 'number', profile: { name: 'string', age: 'number' } },
      });
      expect(deps).toEqual({
        [aliasFilePath]: [filePath.userApi],
        [filePath.profile]: [filePath.userApi],
        [filePath.user]: [filePath.userApi],
        [filePath.identity]: [filePath.userApi],
      });
    });

    it('ignores cyclic star re-exports that do not contain the requested symbol', () => {
      const cycleAPath = path.resolve(`${tmpDir}/src/models/cycleA.ts`);
      const cycleBPath = path.resolve(`${tmpDir}/src/models/cycleB.ts`);
      const leafPath = path.resolve(`${tmpDir}/src/models/leaf.ts`);
      const memoryWithReExportCycle: Record<string, string> = {
        ...memory,
        [filePath.userApi]: `import type { TypeUser } from '@models/cycleA';

export type TypeRequest = TypeUser;
export type TypeResponse = TypeUser;
`,
        [cycleAPath]: `export * from './cycleB';
`,
        [cycleBPath]: `export * from './cycleA';
export * from './leaf';
`,
        [leafPath]: `export type TypeUser = {
  id: string;
};
`,
      };

      const options = prepare(mode, memoryWithReExportCycle, tsconfigPath);
      const {
        deps,
        result: [{ schema }],
      } = createValidators([filePath.userApi], options);

      expect(schema).toEqual({
        request: { id: 'string' },
        response: { id: 'string' },
      });
      expect(deps).toEqual({
        [cycleAPath]: [filePath.userApi],
        [cycleBPath]: [filePath.userApi],
        [leafPath]: [filePath.userApi],
      });
    });
  });
});
