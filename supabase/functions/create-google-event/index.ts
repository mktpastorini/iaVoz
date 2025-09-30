import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { google } from 'https://esm.sh/googleapis@140.0.1';
import { OAuth2Client } from 'https://esm.sh/google-auth-library@9.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("User not authenticated.");

    const { data: tokens, error: tokenError } = await supabaseClient
      .from('user_google_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokens) throw new Error("Google account not connected or tokens not found.");

    const oauth2Client = new OAuth2Client(
      Deno.env.get('GOOGLE_CLIENT_ID'),
      Deno.env.get('GOOGLE_CLIENT_SECRET')
    );

    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: new Date(tokens.expires_at).getTime(),
    });

    // Refresh token if needed
    if (new Date() > new Date(tokens.expires_at)) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await supabaseClient.from('user_google_tokens').update({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expires_at: new Date(credentials.expiry_date!).toISOString(),
      }).eq('user_id', user.id);
      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { title, description, startTime, endTime, clientEmail } = await req.json();

    const event = {
      summary: title,
      description: description,
      start: { dateTime: startTime, timeZone: 'America/Sao_Paulo' },
      end: { dateTime: endTime, timeZone: 'America/Sao_Paulo' },
      attendees: clientEmail ? [{ email: clientEmail }] : [],
      conferenceData: {
        createRequest: {
          requestId: `meet-${user.id}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const { data: createdEvent } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
    });

    return new Response(
      JSON.stringify({
        googleEventId: createdEvent.id,
        meetLink: createdEvent.hangoutLink,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-google-event function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});