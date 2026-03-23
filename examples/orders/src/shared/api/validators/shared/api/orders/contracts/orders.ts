// biome-ignore-all assist/source/organizeImports: This file is auto-generated

export const orders = {
  request: {
    status: [
      'optional',
      [
        'union',
        ['literal', 'draft'],
        ['literal', 'confirmed'],
        ['literal', 'packed'],
        ['literal', 'shipped'],
        ['literal', 'cancelled'],
      ],
    ],
  },
  response: {
    orders: [
      'array',
      {
        id: 'string',
        customerId: 'string',
        total: 'number',
        currency: ['union', ['literal', 'USD'], ['literal', 'EUR']],
        status: [
          'union',
          ['literal', 'draft'],
          ['literal', 'confirmed'],
          ['literal', 'packed'],
          ['literal', 'shipped'],
          ['literal', 'cancelled'],
        ],
        createdAt: 'string',
      },
    ],
  },
} as const;
