import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

// Standard client config
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// Minimal AsyncStorage shim backed by IndexedDB
const storage = {
  getItem: (key: string) => get<string | null>(key).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

// Build a persister that writes the dehydrated cache to IDB
const persister = createAsyncStoragePersister({
  storage,
  throttleTime: 1000, // avoid excessive writes
});

// Call this once before rendering React
export async function setupQueryPersistence() {
  // hydrate previously persisted cache (max 24h old)
  await persistQueryClientRestore({
    queryClient,
    persister,
    buster: 'rep-cache',
    maxAge: 24 * 60 * 60 * 1000,
  });

  // subscribe to changes and persist them
  persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: 'rep-cache',
    // optional: customize dehydration
    // dehydrateOptions: { shouldDehydrateQuery: () => true },
  });
}