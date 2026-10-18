// POST /api/explain
// The forecast numbers come from code (public/engine.js). This function only asks an
// open model served on AMD Token Factory to put those numbers into plain words.
// Guard: any number in the model's text that is not in the input facts rejects the draft.

const NUM = /\d+(?:[.,]\d+)?/g;

function numbersIn(text) {
  return (String(text).match(NUM) || []).map((x) => parseFloat(x.replace(",", ".")));
}

function extractJson(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch (e) { /* try the first {...} block */ }
  const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(clean.slice(a, b + 1)); } catch (e) { /* fall through */ } }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ source: "none", reason: "Use POST." }); return; }

  const base = (process.env.AMD_BASE_URL || "").replace(/\/+$/, "");
  const key = process.env.AMD_API_KEY;
  const model = process.env.AMD_MODEL;
  if (!base || !key || !model) {
    res.status(200).json({ source: "none", reason: "AI is not configured (set AMD_BASE_URL, AMD_API_KEY, AMD_MODEL). Showing the built-in template." });
    return;
  }

  let facts = req.body;
  if (typeof facts === "string") { try { facts = JSON.parse(facts); } catch (e) { facts = null; } }
  if (!facts || !Array.isArray(facts.products) || facts.products.length > 40) {
    res.status(400).json({ source: "none", reason: "Bad request." });
    return;
  }
  const lang = facts.language === "english" ? "english" : "roman_urdu";
  delete facts.language;

  const langRule = lang === "english"
    ? "Write in simple, friendly English."
    : "Write in Roman Urdu (Urdu written in English letters), simple and friendly, the way a shop helper would talk.";

  const system =
    "You help a small kiryana shop owner in Pakistan understand a stock forecast. " +
    "You receive JSON facts that were computed by code. Rules: " +
    "(1) Use ONLY numbers that appear in the JSON and copy them exactly. " +
    "(2) Never add, subtract, average or convert numbers, and never invent products. " +
    "(3) Mention the products whose status is order_now first, then order_soon. " +
    "(4) Say plainly that the forecast is an estimate. " + langRule + " " +
    'Reply with ONLY a JSON object: {"explanation": "max 110 words", "supplier_message": "a polite WhatsApp message to the supplier listing only order_now and order_soon products with their suggestedOrder quantities"}.';

  const allowed = new Set(numbersIn(JSON.stringify(facts)));
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    const r = await fetch(base + "/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(facts) }
        ]
      })
    });
    if (!r.ok) {
      res.status(200).json({ source: "none", reason: "The AI endpoint answered with status " + r.status + ". Showing the built-in template." });
      return;
    }
    const data = await r.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const parsed = extractJson(content || "");
    if (!parsed || typeof parsed.explanation !== "string" || typeof parsed.supplier_message !== "string") {
      res.status(200).json({ source: "none", reason: "The AI reply was not in the expected format. Showing the built-in template." });
      return;
    }
    const extra = [...new Set(numbersIn(parsed.explanation + " " + parsed.supplier_message).filter((n) => !allowed.has(n)))];
    if (extra.length) {
      res.status(200).json({ source: "none", rejected: true, extra,
        reason: "The AI draft used numbers that are not in your data (" + extra.join(", ") + "), so it was blocked. Showing the built-in template." });
      return;
    }
    res.status(200).json({
      source: "ai",
      explanation: parsed.explanation,
      supplier_message: parsed.supplier_message,
      model: data.model || model,
      latencyMs: Date.now() - t0,
      usage: data.usage || null
    });
  } catch (e) {
    res.status(200).json({ source: "none", reason: "Could not reach the AI endpoint (" + (e.name === "AbortError" ? "timeout" : "network error") + "). Showing the built-in template." });
  } finally {
    clearTimeout(timer);
  }
};

