// ============================================================
//  iWorkPDF — Edge Function : suppression de compte
//  L'utilisateur s'identifie via son JWT (Authorization: Bearer ...).
//  On supprime ses fichiers Storage, ses lignes, puis le compte auth.
//  Deploy : supabase functions deploy delete-account
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = 'https://iworkpdf.yendyx.com'
const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!token) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    // Identifier l'utilisateur à partir de son JWT
    const { data: { user }, error: uErr } = await admin.auth.getUser(token)
    if (uErr || !user) return json({ error: 'unauthorized' }, 401)

    // 1. Supprimer ses fichiers du Storage
    const { data: files } = await admin.from('shared_files').select('file_path').eq('user_id', user.id)
    if (files && files.length) {
      await admin.storage.from('pdf-files').remove(files.map((f: { file_path: string }) => f.file_path))
    }
    // 2. Supprimer ses lignes
    await admin.from('shared_files').delete().eq('user_id', user.id)
    await admin.from('audit_logs').delete().eq('user_id', user.id)
    // 3. Supprimer le compte auth
    const { error: dErr } = await admin.auth.admin.deleteUser(user.id)
    if (dErr) throw dErr

    return json({ ok: true })
  } catch (e) {
    console.error('delete-account error:', e)
    return json({ error: 'Internal error' }, 500)
  }
})

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
