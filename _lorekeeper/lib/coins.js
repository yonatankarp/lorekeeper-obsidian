// Coin amounts in quest rewards ("25gp", "3 sp"), shown with their metal's coin (Lorekeeper's reward icons).

const COIN = /\b(\d[\d,]*) ?(pp|gp|ep|sp|cp)\b/gi;

function coinParts(text) {
  const parts = [];
  let at = 0;
  for (const m of text.matchAll(COIN)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index) });
    parts.push({ amount: m[1], metal: m[2].toLowerCase() });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const coinsHtml = (text) =>
  coinParts(text)
    .map((p) => ("text" in p ? escape(p.text) : `<span class="lk-coin lk-coin-${p.metal}" title="${p.metal}">${p.amount}</span>`))
    .join("");

module.exports = { coinParts, coinsHtml };
