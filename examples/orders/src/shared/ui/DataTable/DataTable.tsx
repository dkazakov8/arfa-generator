import type { ReactNode } from 'react';

import styles from './DataTable.module.css';

export type TypeColumn<TRow> = {
  key: string;
  title: string;
  render: (row: TRow) => ReactNode;
};

type PropsDataTable<TRow> = {
  columns: Array<TypeColumn<TRow>>;
  getRowKey: (row: TRow) => string;
  rows: Array<TRow>;
};

export function DataTable<TRow>({ columns, getRowKey, rows }: PropsDataTable<TRow>) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
