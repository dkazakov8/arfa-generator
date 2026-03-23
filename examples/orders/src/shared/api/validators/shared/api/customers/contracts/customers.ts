// biome-ignore-all assist/source/organizeImports: This file is auto-generated

export const customers = {
  request: {
    status: [
      'optional',
      ['union', ['literal', 'active'], ['literal', 'blocked'], ['literal', 'archived']],
    ],
  },
  response: {
    customers: [
      'array',
      {
        id: 'string',
        name: 'string',
        email: 'string',
        status: ['union', ['literal', 'active'], ['literal', 'blocked'], ['literal', 'archived']],
      },
    ],
  },
} as const;
