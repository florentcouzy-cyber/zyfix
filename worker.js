export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    try {
      if (url.pathname === "/") {
        return json({
          ok: true,
          service: "zyfix-worker",
          routes: ["/webhook", "/poll", "/debug-add", "/config"],
        });
      }
      // Route de test manuelle
      if (url.pathname === "/debug-add") {
        const event = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          source: "debug",
          payload: {
            tool: "debug_test",
            nom: "Florent",
            telephone: "0669618283"
          },
        };
        await env.ZYFIX_KV.put(`event:${event.id}`, JSON.stringify(event));
        return json({
          ok: true,
          message: "Event debug ajouté",
          event,
        });
      }
      // Webhook ElevenLabs
      if (url.pathname === "/webhook" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const event = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          source: "elevenlabs",
          payload: body,
        };
        await env.ZYFIX_KV.put(`event:${event.id}`, JSON.stringify(event));
        return json({
          ok: true,
          message: "Webhook reçu",
          event_id: event.id,
          stored: true,
        });
      }
      // Lire les événements
      if (url.pathname === "/poll" && request.method === "GET") {
        const list = await env.ZYFIX_KV.list({ prefix: "event:" });
        const events = [];
        for (const key of list.keys) {
          const value = await env.ZYFIX_KV.get(key.name);
          if (value) events.push(JSON.parse(value));
        }
        events.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return json({
          ok: true,
          count: events.length,
          events,
        });
      }
      // Config Agent Vocal (source de vérité PC <-> Android)
      if (url.pathname === "/config") {
        const secret = request.headers.get("x-zyfix-secret") || "";
        if (!env.ZYFIX_CONFIG_SECRET || secret !== env.ZYFIX_CONFIG_SECRET) {
          return json({ ok: false, error: "Non autorisé" }, 401);
        }
        if (request.method === "GET") {
          const cfg = await env.ZYFIX_KV.get("zyfix_config", { type: "json" });
          return json(cfg || {});
        }
        if (request.method === "POST") {
          const body = await request.json().catch(() => null);
          if (!body) return json({ ok: false, error: "Body invalide" }, 400);
          await env.ZYFIX_KV.put("zyfix_config", JSON.stringify(body));
          return json({ ok: true });
        }
      }
      return json({ ok: false, error: "Route introuvable" }, 404);
    } catch (error) {
      return json({
        ok: false,
        error: error?.message || "Erreur interne",
      }, 500);
    }
  },
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
