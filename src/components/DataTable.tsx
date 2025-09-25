import { ReactNode } from 'react';

interface Column<T> {
  key: keyof T | 'actions';
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  isLoading?: boolean;
  rows?: T[];
  columns: Column<T>[];
}

export default function DataTable<T extends { id: string }>({ 
  isLoading, 
  rows = [], 
  columns 
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <div className="text-gray-500">No data found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full">
        <thead className="border-b bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th 
                key={i} 
                className={`px-4 py-3 text-left text-sm font-medium text-gray-700 ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              {columns.map((col, i) => (
                <td key={i} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                  {col.render ? col.render(row) : String(row[col.key as keyof T] || '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}