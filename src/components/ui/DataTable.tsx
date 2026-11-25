import React from 'react';

export interface DataTableColumn<T> {
  /** Unique identifier for the column. */
  key: string;
  /** Header cell content (string or sortable button). */
  header: React.ReactNode;
  /** Optional utility classes applied to both th and td cells. */
  className?: string;
  /** Cell renderer receiving the row item. */
  render: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  /** Array of records to render as table rows. */
  data: T[];
  /** Column definitions describing headers and cell renderers. */
  columns: DataTableColumn<T>[];
  /** Stable key extractor for each row. */
  getRowKey: (item: T) => string;
  /** Optional row click or keyboard activation handler. */
  onRowActivate?: (item: T) => void;
  /** Optional custom row className resolver. */
  getRowClassName?: (item: T) => string;
  /** Accessible label describing the table. */
  ariaLabel?: string;
}

/**
 * Generic, keyboard-accessible data table primitive with strict TypeScript generics.
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey,
  onRowActivate,
  getRowClassName,
  ariaLabel = 'Data table',
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" aria-label={ariaLabel}>
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {columns.map((col) => (
              <th key={col.key} className={`py-3 px-4 ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {data.map((item) => {
            const key = getRowKey(item);
            const extraClass = getRowClassName ? getRowClassName(item) : '';
            return (
              <tr
                key={key}
                tabIndex={onRowActivate ? 0 : undefined}
                onKeyDown={(e) => {
                  if (
                    onRowActivate &&
                    e.target === e.currentTarget &&
                    (e.key === 'Enter' || e.key === ' ')
                  ) {
                    e.preventDefault();
                    onRowActivate(item);
                  }
                }}
                className={`transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${extraClass}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3.5 px-4 ${col.className ?? ''}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
