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
  useLocation: boolean;
};

export default function VisitStart() {
  const { clientId } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { register, handleSubmit, watch } = useForm<FormData>();
  const useLocation = watch('useLocation');

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast({ kind: 'error', msg: 'Geolocation not supported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        toast({ kind: 'success', msg: 'Location captured' });
      },
      () => {
        toast({ kind: 'error', msg: 'Could not get location' });
      }
    );
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const visitId = uuid();
      
      await enqueue({
        kind: 'insert',
        table: 'visits',
        values: {
          id: visitId,
          client_id: clientId,
          rep_id: user?.id ?? null,
          start_at: new Date().toISOString(),
          checkin_lat: data.useLocation ? location?.lat ?? null : null,
          checkin_long: data.useLocation ? location?.lng ?? null : null,
          notes: data.notes || null
        }
      });

      toast({ kind: 'success', msg: 'Visit started and queued' });
      navigate(`/visit/end/${clientId}`, { 
        state: { visitId } 
      });
      
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Start Visit</h1>
        <p className="text-gray-600">Begin your client visit</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visit Notes (optional)
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Any notes about this visit..."
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            {...register('useLocation')}
            id="useLocation"
            className="rounded"
          />
          <label htmlFor="useLocation" className="text-sm text-gray-700">
            Use my location for check-in
          </label>
        </div>

        {useLocation && (
          <div className="p-3 bg-gray-50 rounded-lg">
            {location ? (
              <p className="text-sm text-green-600">
                ✓ Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            ) : (
              <Button
                type="button"
                onClick={getLocation}
                className="text-sm bg-blue-600 hover:bg-blue-700"
              >
                Get Current Location
              </Button>
            )}
          </div>
        )}

        <div className="pt-4 space-y-2">
          <Button
            type="submit"
            disabled={loading || (useLocation && !location)}
            className="w-full"
          >
            {loading ? 'Starting Visit...' : 'Start Visit'}
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