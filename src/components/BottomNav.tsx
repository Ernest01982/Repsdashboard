import { NavLink } from 'react-router-dom';

export default function BottomNav() {
  const tabs = [
    { to: '/', label: 'Today' },
    { to: '/clients', label: 'Clients' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/orders', label: 'Orders' },
    { to: '/nearby', label: 'Nearby' }
  ];
  
  return (
    <nav className="fixed bottom-0 inset-x-0 z-10 border-t bg-white">
      <div className="mx-auto max-w-md grid grid-cols-5 text-sm">
        {tabs.map(t => (
          <NavLink 
            key={t.to} 
            to={t.to}
            className={({ isActive }) => 
              `py-2 text-center ${isActive ? 'text-gray-900 font-medium' : 'text-gray-600'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}