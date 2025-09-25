import { useQuery } from '@tanstack/react-query';
import { startOfDay, subDays, format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { useAuth } from '../contexts/AuthContext';
import { processQueue, getQueue, hasPending } from '../lib/queue';
import { uploadStaged } from '../lib/photos';
import { useToast } from '../components/Toast';
import Button from '../components/Button';
import DataRow from '../components/DataRow';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';

export default function Home() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [queueCount, setQueueCount] = useState(0);

  // Update queue count
  useEffect(() => {
    const updateCount = async () => {
      const q = await getQueue();
      setQueueCount(q.filter(t => t.status === 'pending' || t.status === 'error').length);
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto sync function
  const performSync = useCallback(async () => {
    const q = await getQueue();
    if (!hasPending(q)) {
      return; // No pending tasks, skip sync
    }
    
    try {
      await processQueue();
      const uploaded = await uploadStaged();
      console.log(`Auto-sync completed: ${uploaded} photos uploaded`);
      setQueueCount(0);
    } catch (error: any) {
      console.error('Auto-sync failed:', error);
      // Don't show error toast for auto-sync failures to avoid interrupting user
    }
  }, []);

  // Auto sync every 15 minutes
  useEffect(() => {
    const interval = setInterval(performSync, 15 * 60 * 1000); // 15 minutes
    return () => clearInterval(interval);
  }, [performSync]);

  const today = startOfDay(new Date());
  const sevenDaysAgo = subDays(today, 7);

  // KPI queries
  const { data: tasksCount } = useQuery({
    queryKey: ['tasks-today-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('rep_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .eq('rep_id', user?.id)
        .eq('status', 'open')
        .gte('due_at', today.toISOString())
        .lt('due_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user
  });

  const { data: visitsCount } = useQuery({
    queryKey: ['visits-week-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('visits')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .eq('rep_id', user?.id)
        .gte('start_at', sevenDaysAgo.toISOString());
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user
  });

  const { data: ordersCount } = useQuery({
    queryKey: ['orders-week-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .eq('rep_id', user?.id)
        .gte('order_date', sevenDaysAgo.toISOString());
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user
  });

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-gray-600">{format(new Date(), 'EEEE, MMM d')}</p>
      </div>

      {queueCount > 0 && (
        <div className="mb-4 rounded-lg bg-blue-50 p-3 border border-blue-200">
          <p className="text-blue-800 text-sm">
            Queued: {queueCount} actions waiting to sync
          </p>
        </div>
      )}

      <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Quick Stats</h2>
        <DataRow 
          left="Tasks due today" 
          right={tasksCount ?? '...'} 
        />
        <DataRow 
          left="Visits (7d)" 
          right={visitsCount ?? '...'} 
        />
        <DataRow 
          left="Orders (7d)" 
          right={ordersCount ?? '...'} 
        />
      </div>

      <div className="space-y-3">
        <Button 
          onClick={() => navigate('/clients')}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Start Day
        </Button>
        
        <Button 
          onClick={() => navigate('/notes')}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          Quick Note
        </Button>
      </div>
    </div>
  );
}