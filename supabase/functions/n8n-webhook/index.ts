import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = "https://msgrato.app.n8n.cloud/webhook-test/44d6986d-55f4-4771-a96e-facfbd984fb5";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Parse optional payload from request body
    let payload = {};
    if (req.method === 'POST') {
      try {
        payload = await req.json();
      } catch {
        // No body is fine
      }
    }

    // Call n8n webhook via GET with query params
    const url = new URL(N8N_WEBHOOK_URL);
    url.searchParams.set('triggered_by', claimsData.claims.sub);
    url.searchParams.set('triggered_at', new Date().toISOString());
    for (const [key, value] of Object.entries(payload)) {
      url.searchParams.set(key, String(value));
    }
    const n8nResponse = await fetch(url.toString(), { method: 'GET' });

    const n8nResult = await n8nResponse.text();

    return new Response(JSON.stringify({ success: true, n8n_response: n8nResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
