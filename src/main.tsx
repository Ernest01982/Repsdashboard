import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { setupQueryPersistence } from './lib/queryClient';
import App from './App';
import './index.css';
import { processQueue } from './lib/queue';
import { uploadStaged } from './lib/photos';

function AppWithAutoSync() {
  React.useEffect(() => {
    const handleOnline = async () => {
      try {
        await processQueue();
        await uploadStaged();
        console.log('Auto-sync completed');
      } catch (error) {
        console.error('Auto-sync failed:', error);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return <App />;
}

(async () => {
  await setupQueryPersistence();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AppWithAutoSync />
      </BrowserRouter>
    </React.StrictMode>
  );
})();