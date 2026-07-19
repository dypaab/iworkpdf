// ============================================================
//  iWorkPDF — Edge Function : formulaire de contact → email admin (Resend)
//  Variables d'env requises :
//    RESEND_API_KEY  (clé API Resend)
//    CONTACT_TO      (email admin destinataire, ex: contact@yendyx.com)
//    CONTACT_FROM    (expéditeur vérifié dans Resend, ex: iWorkPDF <noreply@yendyx.com>)
//  Deploy : supabase functions deploy contact
// ============================================================
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
    const body = await req.json()
    const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().substring(0, n) : '')
    const name = clean(body.name, 80)
    const email = clean(body.email, 120)
    const message = clean(body.message, 4000)

    if (message.length < 5) return json({ error: 'invalid' }, 400)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'invalid_email' }, 400)

    const RESEND = Deno.env.get('RESEND_API_KEY')
    const TO = Deno.env.get('CONTACT_TO') || 'contact@yendyx.com'
    const FROM = Deno.env.get('CONTACT_FROM') || 'iWorkPDF <noreply@yendyx.com>'
    if (!RESEND) return json({ error: 'not_configured' }, 500)

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email || undefined,
        subject: `Contact iWorkPDF — ${name || 'Visiteur'}`,
        text: `Nom: ${name || '—'}\nEmail: ${email || '—'}\n\n${message}`,
      }),
    })
    if (!r.ok) { console.error('resend:', await r.text()); return json({ error: 'send_failed' }, 502) }
    return json({ ok: true })
  } catch (e) {
    console.error('contact error:', e)
    return json({ error: 'error' }, 500)
  }
})

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
