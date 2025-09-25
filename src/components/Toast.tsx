import { createContext, useContext, useState, ReactNode } from 'react';

type Toast = { id: number; kind: 'success'|'error'|'info'; msg: string };

const Ctx = createContext<{ show: (t: Omit<Toast, 'id'>) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  function show(t: Omit<Toast, 'id'>) { 
    const id = Date.now(); 
    setToasts(p => [...p, { id, ...t }]); 
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), t.kind === 'error' ? 5000 : 3000); 
  }
  
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 flex flex-col gap-2">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`pointer-events-auto rounded-xl px-3 py-2 text-sm shadow ${
              t.kind === 'success' ? 'bg-emerald-600 text-white' : 
              t.kind === 'error' ? 'bg-rose-600 text-white' : 
              'bg-gray-800 text-white'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { 
  const ctx = useContext(Ctx); 
  if (!ctx) throw new Error('ToastProvider missing'); 
  return ctx.show; 
}