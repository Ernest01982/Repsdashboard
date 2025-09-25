import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { enqueue } from '../lib/queue';
import { TENANT_ID } from '../lib/env';
import { useToast } from '../components/Toast';
import Button from '../components/Button';

type FormData = {
  outcome: string;
  notes: string;
  useLocation: boolean;
};

export default function VisitEnd() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);

  const visitId = routerLocation.state?.visitId;

  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      outcome: 'completed'
    }
  });
  const useLocationValue = watch('useLocation');

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast({ kind: 'error', msg: 'Geolocation not supported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocation({
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
    if (!visitId) {
      toast({ kind: 'error', msg: 'No visit ID found' });
      return;
    }

    setLoading(true);
    try {
      await enqueue({
        kind: 'update',
        table: 'visits',
        where: { id: visitId },
        values: {
          end_at: new Date().toISOString(),
          checkout_lat: data.useLocation ? geoLocation?.lat ?? null : null,
          checkout_long: data.useLocation ? geoLocation?.lng ?? null : null,
          outcome: data.outcome || null,
          notes: data.notes || null
        }
      });

      toast({ kind: 'success', msg: 'Visit ended and queued' });
      navigate(`/clients/${clientId}`);
      
    } catch (error: any) {
      toast({ kind: 'error', msg: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (!visitId) {
    return (
      <div className="p-4">
        <div className="text-center">
          <p className="text-gray-600">No active visit found</p>
          <Button 
            onClick={() => navigate(`/clients/${clientId}`)}
            className="mt-4"
          >
            Back to Client
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">End Visit</h1>
        <p className="text-gray-600">Complete your client visit</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visit Outcome
          </label>
          <select
            {...register('outcome')}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="cancelled">Cancelled</option>
            <option value="rescheduled">Rescheduled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes (optional)
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Any additional notes about this visit..."
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
            Use my location for check-out
          </label>
        </div>

        {useLocationValue && (
          <div className="p-3 bg-gray-50 rounded-lg">
            {geoLocation ? (
              <p className="text-sm text-green-600">
                ✓ Location captured: {geoLocation.lat.toFixed(4)}, {geoLocation.lng.toFixed(4)}
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
            disabled={loading || (useLocationValue && !geoLocation)}
            className="w-full"
          >
            {loading ? 'Ending Visit...' : 'End Visit'}
          </Button>
          
          <Button
            type="button"
            onClick={() => navigate(`/clients/${clientId}`)}
            className="w-full bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}