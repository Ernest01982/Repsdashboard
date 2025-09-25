import imageCompression from 'browser-image-compression';
import { set, get } from 'idb-keyval';
import { supabase } from './supabase';
import { TENANT_ID } from './env';

export type LocalPhoto = { 
  id: string; 
  visit_id?: string; 
  client_id?: string; 
  blob: Blob; 
  taken_at: string; 
  label?: string 
};

const KEY = 'photos-pending';

export async function stagePhoto(p: LocalPhoto) { 
  const arr = (await get<LocalPhoto[]>(KEY)) ?? []; 
  arr.push(p); 
  await set(KEY, arr); 
}

export async function listStaged() { 
  return (await get<LocalPhoto[]>(KEY)) ?? []; 
}

export async function clearStaged(ids: string[]) { 
  const all = await listStaged(); 
  await set(KEY, all.filter(p => !ids.includes(p.id))); 
}

export async function uploadStaged(creator?: string) {
  const staged = await listStaged(); 
  
  if (staged.length === 0) {
    return 0; // No photos to upload
  }
  
  const doneIds: string[] = [];
  
  for (const p of staged) {
    try {
      const sourceFile = p.blob instanceof File
        ? p.blob
        : new File([p.blob], `${p.id}.jpg`, { type: p.blob.type || 'image/jpeg' });

      const compressed = await imageCompression(sourceFile, {
        maxWidthOrHeight: 1280,
        maxSizeMB: 1
      });

      const uploadFile = compressed instanceof File
        ? compressed
        : new File([compressed], `${p.id}.jpg`, { type: 'image/jpeg' });

      const path = `${TENANT_ID}/${p.visit_id ?? 'no-visit'}/${p.id}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('photos')
        .upload(path, uploadFile, {
          upsert: true, 
          contentType: 'image/jpeg' 
        });
        
      if (upErr) {
        console.error('Photo upload failed:', upErr);
        continue;
      }
      
      const { data: url } = supabase.storage
        .from('photos')
        .getPublicUrl(path);
      
      const { error: insertErr } = await supabase.from('photos').insert({
        id: p.id, 
        tenant_id: TENANT_ID, 
        client_id: p.client_id ?? null, 
        visit_id: p.visit_id ?? null,
        url: url.publicUrl, 
        label: p.label ?? null, 
        taken_at: p.taken_at, 
        created_by: creator
      });
      
      if (insertErr) {
        console.error('Photo record insert failed:', insertErr);
        continue;
      }
      
      doneIds.push(p.id);
    } catch (error) {
      console.error('Photo processing failed:', error);
      continue;
    }
  }
  
  if (doneIds.length) await clearStaged(doneIds);
  return doneIds.length;
}