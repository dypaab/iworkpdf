// ============================================================
//  iWorkPDF — Edge Function : nettoyage auto 48h
//  Deploy : supabase functions deploy cleanup --schedule "0 * * * *"
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service_role uniquement
)

Deno.serve(async (req) => {
  // Vérification du cron secret pour éviter les appels non autorisés
  // Fail-closed : sans CRON_SECRET configuré, on refuse tout (au lieu d'ouvrir l'accès).
  const cronSecret = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // 1. Récupérer les paths des fichiers expirés
    const { data: expired, error: fetchErr } = await sb
      .from('shared_files')
      .select('id, file_path, user_id')
      .lt('expires_at', new Date().toISOString())

    if (fetchErr) throw fetchErr

    if (!expired || expired.length === 0) {
      return json({ deleted: 0, message: 'Nothing to clean' })
    }

    // 2. Supprimer du Storage (fichiers réels)
    const paths = expired.map(f => f.file_path)
    const { error: storageErr } = await sb.storage
      .from('pdf-files')
      .remove(paths)

    if (storageErr) {
      console.error('Storage cleanup partial error:', storageErr.message)
    }

    // 3. Supprimer de la base de données
    const ids = expired.map(f => f.id)
    const { error: dbErr } = await sb
      .from('shared_files')
      .delete()
      .in('id', ids)

    if (dbErr) throw dbErr

    // 4. Log de l'opération dans audit_logs
    await sb.from('audit_logs').insert({
      user_id: null,
      action: 'auto_cleanup',
      metadata: {
        deleted_count: expired.length,
        deleted_ids: ids,
        run_at: new Date().toISOString(),
      }
    })

    console.log(`✅ Cleaned ${expired.length} expired file(s)`)
    return json({ deleted: expired.length })

  } catch (err) {
    console.error('Cleanup error:', err)
    return json({ error: 'Internal error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
