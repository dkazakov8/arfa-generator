// biome-ignore-all assist/source/organizeImports: This file is auto-generated

export const invoices = {
  request: {
    status: [
      'optional',
      [
        'union',
        ['literal', 'draft'],
        ['literal', 'sent'],
        ['literal', 'paid'],
        ['literal', 'overdue'],
        ['literal', 'void'],
      ],
    ],
  },
  response: {
    invoices: [
      'array',
      {
        id: 'string',
        orderId: 'string',
        amount: 'number',
        currency: ['union', ['literal', 'USD'], ['literal', 'EUR']],
        status: [
          'union',
          ['literal', 'draft'],
          ['literal', 'sent'],
          ['literal', 'paid'],
          ['literal', 'overdue'],
          ['literal', 'void'],
        ],
        dueDate: 'string',
      },
    ],
  },
} as const;
