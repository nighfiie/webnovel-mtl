import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Public, read-only projections: never return reader data or chapter bodies here.
export const readPublicCatalog = createServerFn({ method: 'GET' }).handler(async () => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('The novel catalog is temporarily unavailable.');
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
  const novels = [];
  // Page through the catalog rather than silently stopping at the Data API row limit.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('novels').select('id,slug,title,original_title,language_mode,translated_language,original_language,original_author,synopsis,cover_url,featured_image_url,category,genres,tags,status,total_chapters,rating,reviews_count,view_count,weekly_views,created_at,updated_at').order('id').range(offset, offset + 999);
    if (error) throw new Error('Unable to load novels. Please try again.');
    novels.push(...(data ?? []).map(n => ({ ...n, owner_id: null })));
    if (!data || data.length < 1000) break;
  }
  const { data: chapters, error } = await client.from('chapters')
    .select('id,novel_id,number,title,created_at,updated_at')
    .order('created_at', { ascending: false }).order('number', { ascending: false }).limit(200);
  if (error) throw new Error('Unable to load chapter updates. Please try again.');
  return { novels, chapters: chapters ?? [] };
});
