import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { processQueue } from '../lib/queue';
import { uploadStaged } from '../lib/photos';
import Button from './Button';
import { useState } from 'react';

export default function Header() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ kind: 'success', msg: 'Signed out successfully' });
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message || 'Sign out failed' });
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const processedQueue = await processQueue();
      const uploadedPhotos = await uploadStaged(user?.id);
      
      const pendingCount = processedQueue.filter(t => t.status === 'pending' || t.status === 'error').length;
      
      if (pendingCount === 0) {
        toast({ 
          kind: 'success', 
          msg: `Sync complete: ${processedQueue.length} actions, ${uploadedPhotos} photos` 
        });
      } else {
        toast({ 
          kind: 'error', 
          msg: `Sync partial: ${pendingCount} actions failed` 
        });
      }
    } catch (error: any) {
      toast({ kind: 'error', msg: `Sync failed: ${error.message}` });
    } finally {
      setSyncing(false);
    }
  };
  if (!user) return null;

  return (
    <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
      <div>
        <h1 className="font-semibold text-gray-900">Wine CRM Rep</h1>
        <p className="text-sm text-gray-600">{user.email}</p>
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={handleSyncNow}
          disabled={syncing}
          className="text-sm bg-blue-600 hover:bg-blue-700"
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
        
        <Button
          onClick={handleSignOut}
          className="text-sm bg-gray-600 hover:bg-gray-700"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}