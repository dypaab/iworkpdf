import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = 'https://iworkpdf.yendyx.com'
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { page, tool, referrer, lang, ua_type } = await req.json()
    if (!page || typeof page !== 'string')
      return new Response(JSON.stringify({ error: 'invalid' }), { status: 400, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    // Valeurs bornées et non fiables (client) : on tronque et on n'accepte que des types connus.
    const uaClean = (ua_type === 'mobile' || ua_type === 'desktop') ? ua_type : 'desktop'
    await supabase.from('pageviews').insert({
      page: String(page).substring(0, 200),
      tool: typeof tool === 'string' ? tool.substring(0, 50) : null,
      referrer: typeof referrer === 'string' ? referrer.substring(0, 200) : null,
      lang: typeof lang === 'string' ? lang.substring(0, 5) : null,
      ua_type: uaClean,
      created_at: new Date().toISOString(), // horodatage serveur, jamais celui du client
    })
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('track-pageview error:', e)
    return new Response(JSON.stringify({ error: 'error' }), { status: 500, headers: corsHeaders })
  }
})
