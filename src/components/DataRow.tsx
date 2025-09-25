import { ReactNode } from 'react';

export default function DataRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 first:border-t-0">
      {left}
      <div className="text-right text-gray-600">{right}</div>
    </div>
  );
}