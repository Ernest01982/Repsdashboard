import { ReactNode } from 'react';

export default function Modal({ 
  open, 
  onClose, 
  title, 
  children 
}: { 
  open: boolean; 
  onClose: () => void; 
  title: string; 
  children: ReactNode 
}) {
  if (!open) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" 
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl" 
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button 
            onClick={onClose} 
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}