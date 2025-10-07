import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// IMPORTANT: These environment variables must be set in Deno Deploy
const BASE44_APP_ID = Deno.env.get("BASE44_APP_ID");
const BASE44_API_KEY = Deno.env.get("BASE44_API_KEY");

// Construct the URL for your internal Base44 function dynamically
// Ensure this matches the exact API endpoint shown in your Base44 dashboard for generateIcalExport
const BASE44_FUNCTION_URL = `https://space-book-${BASE44_APP_ID}.base44.app/api/apps/${BASE44_APP_ID}/functions/generateIcalExport`;

console.log("Deno Deploy iCal Gateway starting...");

serve(async (req: Request) => {
    const url = new URL(req.url);
    console.log(`Received request: ${req.method} ${url.pathname}`);

    // Define CORS headers for the iCal feed (optional, but good practice)
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS pre-flight request
    if (req.method === 'OPTIONS') {
        console.log('OPTIONS request received (pre-flight)');
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Only handle GET requests for the specific path for iCal export
    if (req.method === "GET" && url.pathname === "/ical/export") {
        const token = url.searchParams.get("token");
        console.log(`GET /ical/export received. Token: ${token ? 'YES' : 'NO'} (${token})`);

        if (!token) {
            console.warn("Missing token for /ical/export request.");
            return new Response("Missing token parameter", { status: 400, headers: corsHeaders });
        }

        try {
            console.log(`Making authenticated POST to Base44 function: ${BASE44_FUNCTION_URL}`);
            // Make an authenticated POST request to your internal Base44 function
            const response = await fetch(BASE44_FUNCTION_URL, {
                method: "POST", // Base44 internal functions expect POST
                headers: {
                    "Content-Type": "application/json",
                    "api_key": BASE44_API_KEY, // Authenticate with your Base44 API key
                },
                body: JSON.stringify({ token: token }), // Send token in the request body
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Error from Base44 function (${response.status}): ${errorBody}`);
                return new Response(`Error fetching iCal data from Base44: ${response.status} - ${errorBody}`, { status: response.status, headers: corsHeaders });
            }

            const icalContent = await response.text();
            console.log("Successfully fetched iCal content from Base44.");

            return new Response(icalContent, {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/calendar; charset=utf-8",
                    "Content-Disposition": "attachment; filename=\"spacebook-calendar.ics\"", // Suggests download
                },
            });
        } catch (error) {
            console.error("External handler encountered an error calling Base44:", error);
            return new Response(`External handler internal error: ${error.message}`, { status: 500, headers: corsHeaders });
        }
    }

    console.log(`Unhandled request: ${req.method} ${url.pathname}`);
    return new Response("Not Found", { status: 404, headers: corsHeaders });
});
