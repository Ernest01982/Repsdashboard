import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { enqueue } from '../lib/queue';
import { uuid } from '../lib/ids';
import { TENANT_ID } from '../lib/env';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import Button from '../components/Button';

type FormData = {
  notes: string;
};

export default function Notes() {
  const { clientId } = useParams<{ clientId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    if (!data.notes.trim()) {
      toast({ kind: 'error', msg: 'Please enter a note' });
      return;
    }

    setLoading(true);
    try {
      const visitId = uuid();
      const now = new Date().toISOString();

      // Create a quick visit with notes
      await enqueue({
        kind: 'insert',
        table: 'visits',
        values: {
          id: visitId,
          client_id: clientId ?? null,
          rep_id: user?.id ?? null,
          start_at: now,
          end_at: now, // Quick note visit has same start/end time
          notes: data.notes.trim()
        }
      });

      toast({ kind: 'success', msg: 'Note saved and queued' });
      reset();
      
      if (clientId) {
        navigate(`/clients/${clientId}`);
      } else {
        navigate('/');
      }
      
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Quick Note</h1>
        <p className="text-gray-600">
          {clientId ? 'Add a note for this client' : 'Add a general note'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Note
          </label>
          <textarea
            {...register('notes', { required: true })}
            rows={6}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Enter your note here..."
            autoFocus
          />
        </div>

        <div className="pt-4 space-y-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Saving Note...' : 'Save Note'}
          </Button>
          
          <Button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}