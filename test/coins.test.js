const { test } = require("node:test");
const assert = require("node:assert/strict");
const { coinParts, coinsHtml } = require("../_lorekeeper/lib/coins.js");

test("coinParts finds every metal, with or without a space", () => {
  assert.deepEqual(coinParts("25gp, 3 sp and 1,200 CP"), [
    { amount: "25", metal: "gp" },
    { text: ", " },
    { amount: "3", metal: "sp" },
    { text: " and " },
    { amount: "1,200", metal: "cp" },
  ]);
  assert.deepEqual(coinParts("a magic sword"), [{ text: "a magic sword" }]);
  assert.deepEqual(coinParts("10gpx"), [{ text: "10gpx" }]);
});

test("coinsHtml escapes text and marks coins", () => {
  assert.equal(
    coinsHtml("5 pp & <b>x</b>"),
    '<span class="lk-coin lk-coin-pp" title="pp">5</span> &amp; &lt;b&gt;x&lt;/b&gt;',
  );
});
