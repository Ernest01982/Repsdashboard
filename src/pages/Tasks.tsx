import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { TENANT_ID } from '../lib/env';
import { useAuth } from '../contexts/AuthContext';

export default function Tasks() {
  const { user } = useAuth();
  
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rep_tasks')
        .select(`
          id, due_at, status, notes,
          client:client_id(name)
        `)
        .eq('tenant_id', TENANT_ID)
        .eq('rep_id', user?.id)
        .eq('status', 'open')
        .order('due_at')
        .limit(500);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  if (isLoading) return <div className="p-4">Loading tasks...</div>;

  const isOverdue = (dueAt: string) => {
    return new Date(dueAt) < new Date();
  };

  return (
    <div className="pb-20">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-gray-900">Open Tasks</h1>
        <p className="text-gray-600">Your pending tasks</p>
      </div>

      <div className="divide-y">
        {tasks?.map(task => (
          <div key={task.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium text-gray-900">{task.client?.name}</h3>
                <p className={`text-sm ${
                  isOverdue(task.due_at) ? 'text-red-600 font-medium' : 'text-gray-600'
                }`}>
                  Due: {new Date(task.due_at).toLocaleDateString()}
                  {isOverdue(task.due_at) && ' (Overdue)'}
                </p>
              </div>
              
              <span className={`px-2 py-1 rounded text-xs ${
                isOverdue(task.due_at) 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {task.status}
              </span>
            </div>
            
            {task.notes && (
              <p className="text-sm text-gray-600">{task.notes}</p>
            )}
          </div>
        ))}
      </div>
      
      {tasks?.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No open tasks
        </div>
      )}
    </div>
  );
}