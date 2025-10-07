import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

console.log('Deno Deploy iCal Gateway starting...');

Deno.serve(async (req) => {
    console.log('Received request:', req.method, new URL(req.url).pathname);

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, api_key',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(req.url);

    if (url.pathname === '/ical/export') {
        try {
            const token = url.searchParams.get('token');
            console.log('GET /ical/export received. Token:', token ? 'YES (' + token + ')' : 'NO');

            if (!token) {
                return Response.json({ error: 'Missing export token' }, { status: 400, headers: corsHeaders });
            }

            const BASE44_APP_ID = Deno.env.get("BASE44_APP_ID");
            if (!BASE44_APP_ID) {
                console.error("BASE44_APP_ID environment variable not set in Deno Deploy project.");
                return Response.json({
                    error: 'Server configuration error: BASE44_APP_ID not set'
                }, { status: 500, headers: corsHeaders });
            }

            console.log('Using BASE44_APP_ID:', BASE44_APP_ID);

            // --- NEW CRITICAL CHANGE: Create a modified Request object with the header ---
            const modifiedHeaders = new Headers(req.headers);
            modifiedHeaders.set('Base44-App-Id', BASE44_APP_ID);

            const modifiedReq = new Request(req.url, {
                method: req.method,
                headers: modifiedHeaders,
                body: req.body,
                redirect: req.redirect,
                referrer: req.referrer,
                signal: req.signal,
            });
            // --- END NEW CRITICAL CHANGE ---

            // Initialize Base44 SDK with the modified Request object
            const base44 = createClientFromRequest(modifiedReq, { app_id: BASE44_APP_ID });

            const base44Response = await base44.asServiceRole.functions.invoke('generateIcalExport', { token });

            console.log('Successfully fetched iCal content from Base44.');

            // The SDK's invoke method returns an object with a 'data' property
            const icsContent = base44Response.data;

            return new Response(icsContent, {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/calendar; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="spacebook-bookings.ics"',
                },
            });

        } catch (error) {
            console.error('Error in iCal export:', error);
            // Include error details for easier debugging
            return Response.json({
                error: 'Failed to generate iCal feed',
                details: error.message,
                stack: error.stack
            }, { status: 500, headers: corsHeaders });
        }
    }

    console.log('Unhandled request:', req.method, url.pathname);
    return new Response('iCal Gateway - Only /ical/export endpoint is available', {
        status: 404,
        headers: corsHeaders
    });
});
