/* Dukaan Dost — forecasting engine.
   Plain code, no AI: weekday pattern + exponential smoothing, backtest, restock rules.
   Works in the browser (window.DD) and in Node (module.exports) for testing. */
(function (root) {
  var DAY = 86400000;
  var Z = 1.28; // ~90% service level for safety stock

  function parseDate(s) {
    s = String(s).trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s); // DD/MM/YYYY
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return NaN;
  }
  function fmtDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function dowOf(ms) { return new Date(ms).getUTCDay(); }

  function splitCSV(line) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); });
  }

  function parseCSV(text) {
    var lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) throw new Error("The file is empty. Expected columns: date, product, units_sold.");
    var head = splitCSV(lines[0]).map(function (h) { return h.toLowerCase(); });
    var iD = head.findIndex(function (h) { return h.indexOf("date") >= 0; });
    var iP = head.findIndex(function (h) { return /product|item|name/.test(h); });
    var iU = head.findIndex(function (h) { return /unit|qty|quantity|sold/.test(h); });
    if (iD < 0 || iP < 0 || iU < 0)
      throw new Error("Could not find the columns. The first row must have: date, product, units_sold.");
    var rows = [], bad = 0;
    for (var i = 1; i < lines.length; i++) {
      var c = splitCSV(lines[i]);
      var d = parseDate(c[iD]), u = parseFloat(c[iU]), p = (c[iP] || "").trim();
      if (isNaN(d) || isNaN(u) || !p || u < 0) { bad++; continue; }
      rows.push({ d: d, p: p, u: u });
    }
    if (!rows.length) throw new Error("No valid rows found. Dates should look like 2026-10-01 or 01/10/2026.");
    return { rows: rows, skipped: bad };
  }

  // Turn rows into one daily series per product. Missing days count as zero sales.
  function buildSeries(rows) {
    var min = Infinity, max = -Infinity;
    rows.forEach(function (r) { if (r.d < min) min = r.d; if (r.d > max) max = r.d; });
    var n = Math.round((max - min) / DAY) + 1;
    if (n < 42) throw new Error("Need at least 6 weeks (42 days) of daily sales. Your file covers " + n + " days.");
    var dates = [], dows = [];
    for (var i = 0; i < n; i++) { dates.push(min + i * DAY); dows.push(dowOf(min + i * DAY)); }
    var map = {};
    rows.forEach(function (r) {
      if (!map[r.p]) { map[r.p] = []; for (var k = 0; k < n; k++) map[r.p].push(0); }
      map[r.p][Math.round((r.d - min) / DAY)] += r.u;
    });
    var products = Object.keys(map).map(function (name) {
      var y = map[name];
      var avg = y.slice(-14).reduce(function (a, b) { return a + b; }, 0) / 14;
      return { name: name, y: y, stock: Math.max(0, Math.round(avg * 3)) };
    });
    return { dates: dates, dows: dows, n: n, products: products };
  }

  function mean(a, from, to) {
    var s = 0, c = 0;
    for (var i = Math.max(0, from); i < to; i++) { s += a[i]; c++; }
    return c ? s / c : 0;
  }

  // Fit on y[0..end): weekday index + exponential smoothing on the de-seasonalised series.
  function fit(y, dows, end, alpha) {
    alpha = alpha || 0.3;
    var start = Math.max(0, end - 56);
    var sums = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0], tot = 0, n = 0, i;
    for (i = start; i < end; i++) { sums[dows[i]] += y[i]; cnt[dows[i]]++; tot += y[i]; n++; }
    var mu = n ? tot / n : 0;
    var idx = sums.map(function (s, d) { return cnt[d] && mu > 0 ? (s / cnt[d]) / mu : 1; });
    var im = idx.reduce(function (a, b) { return a + b; }, 0) / 7;
    idx = idx.map(function (v) { return Math.max(v / im, 0.2); });
    var ds = [];
    for (i = start; i < end; i++) ds.push(y[i] / idx[dows[i]]);
    var k0 = Math.min(7, ds.length), level = 0;
    for (i = 0; i < k0; i++) level += ds[i];
    level = k0 ? level / k0 : 0;
    var errs = [];
    for (i = k0; i < ds.length; i++) {
      var d = dows[start + i];
      errs.push(y[start + i] - level * idx[d]);
      level = alpha * ds[i] + (1 - alpha) * level;
    }
    var sigma = errs.length ? Math.sqrt(errs.reduce(function (a, e) { return a + e * e; }, 0) / errs.length) : 0;
    return { level: level, idx: idx, sigma: sigma };
  }
  function fc(m, dow, h) { return Math.max(0, m.level * m.idx[(dow + h) % 7]); }

  function simulate(y, dows, first, n, ms, policy, R, L) {
    var horizon = R + L;
    function base(t) { return mean(y, t - 7, t) * horizon; }
    function target(t) {
      if (policy === "base") return base(t);
      var m = ms[t - first], s = 0;
      for (var h = 0; h < horizon; h++) s += fc(m, dows[t], h);
      return s + Z * m.sigma * Math.sqrt(horizon);
    }
    var stock = base(first), pipe = [], lost = 0, units = 0, stockDays = 0, stockSum = 0;
    for (var t = first; t < n; t++) {
      pipe = pipe.filter(function (o) { if (o.arrive <= t) { stock += o.qty; return false; } return true; });
      if ((t - first) % R === 0) {
        var inPipe = pipe.reduce(function (a, o) { return a + o.qty; }, 0);
        var q = Math.max(0, Math.round(target(t) - stock - inPipe));
        if (q > 0) pipe.push({ arrive: t + L, qty: q });
      }
      var sold = Math.min(stock, y[t]);
      if (y[t] > sold) { lost += y[t] - sold; stockDays++; }
      units += y[t]; stock -= sold; stockSum += stock;
    }
    return { lost: lost, units: units, stockDays: stockDays, avgStock: stockSum / (n - first) };
  }

  // Last 28 days are held out. Compare the model with the "last 7 days average" rule.
  function backtest(S, R, L) {
    var H = 28, first = S.n - H;
    var absM = 0, absB = 0, tot = 0;
    var agg = { base: { lost: 0, units: 0, stockDays: 0, avgStock: 0 }, model: { lost: 0, units: 0, stockDays: 0, avgStock: 0 } };
    S.products.forEach(function (p) {
      var ms = [];
      for (var t = first; t < S.n; t++) {
        var m = fit(p.y, S.dows, t); ms.push(m);
        var f = fc(m, S.dows[t], 0), b = mean(p.y, t - 7, t);
        absM += Math.abs(p.y[t] - f); absB += Math.abs(p.y[t] - b); tot += p.y[t];
      }
      ["base", "model"].forEach(function (k) {
        var r = simulate(p.y, S.dows, first, S.n, ms, k, R, L);
        agg[k].lost += r.lost; agg[k].units += r.units; agg[k].stockDays += r.stockDays; agg[k].avgStock += r.avgStock;
      });
    });
    function fin(a) { return { fillRate: a.units ? 100 * (1 - a.lost / a.units) : 100, stockDays: a.stockDays, avgStock: a.avgStock, lostUnits: a.lost }; }
    return {
      days: H, products: S.products.length,
      wapeModel: tot ? 100 * absM / tot : 0, wapeNaive: tot ? 100 * absB / tot : 0,
      model: fin(agg.model), base: fin(agg.base)
    };
  }

  // Today's advice for one product.
  function recommend(S, p, R, L) {
    var m = fit(p.y, S.dows, S.n), next = (S.dows[S.n - 1] + 1) % 7;
    var f7 = [], i;
    for (i = 0; i < 7; i++) f7.push(fc(m, next, i));
    var rem = p.stock, cover = 14;
    for (i = 0; i < 14; i++) {
      var f = fc(m, next, i);
      if (rem >= f) rem -= f;
      else { cover = i + (f > 0 ? rem / f : 0); break; }
    }
    var horizon = R + L, need = 0;
    for (i = 0; i < horizon; i++) need += fc(m, next, i);
    need += Z * m.sigma * Math.sqrt(horizon);
    var status = cover < L ? "order_now" : cover < L + R ? "order_soon" : "ok";
    var qty = status === "ok" ? 0 : Math.max(0, Math.ceil(need - p.stock));
    return {
      name: p.name, stock: p.stock, cover: Math.round(cover * 10) / 10, coverCapped: cover >= 14,
      next7: Math.round(f7.reduce(function (a, b) { return a + b; }, 0)), f7: f7, sigma: m.sigma,
      qty: qty, status: status, model: m, nextDow: next
    };
  }

  // ---------- Sample shop (deterministic, clearly synthetic) ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var SAMPLE = [
    ["Doodh 1L", 38, [1, 1, 1, 1, 1, 1.05, 1.05], 0, 1],
    ["Anda (dozen)", 14, [1.1, .95, .95, .95, 1, 1.05, 1.1], 0, 1],
    ["Dahi 500g", 16, [1.2, .9, .9, .9, .95, 1.15, 1.25], 0, 1],
    ["Chai patti 190g", 9, [1, 1, 1, 1, 1, 1, 1], 0, 1.25],
    ["Cooking oil 1L", 7, [1.15, .9, .9, .95, 1, 1.1, 1.2], 0, 1.5],
    ["Atta 10kg", 5, [1.1, .95, .95, .95, 1, 1.05, 1.1], 0, 1.6],
    ["Cheeni 1kg", 11, [1, 1, 1, 1, 1, 1, 1], 0, 1.3],
    ["Cold drink 1.5L", 18, [1.35, .85, .85, .9, 1, 1.3, 1.4], 0.004, 1],
    ["Biscuit pack", 24, [1.1, .95, .95, .95, 1, 1.1, 1.2], 0, 1]
  ];
  function makeSample(endMs) {
    var days = 120, R = rng(2026), rows = [];
    function gauss() { return Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()); }
    for (var i = 0; i < days; i++) {
      var d = endMs - (days - 1 - i) * DAY, dow = dowOf(d), dom = new Date(d).getUTCDate();
      SAMPLE.forEach(function (s) {
        var mu = s[1] * s[2][dow] * (1 + s[3] * i) * (dom <= 7 ? s[4] : 1);
        var v = Math.max(0, Math.round(mu + gauss() * Math.sqrt(mu) * 0.9));
        rows.push({ d: d, p: s[0], u: v });
      });
    }
    return rows;
  }
  function toCSV(rows) {
    return "date,product,units_sold\n" + rows.map(function (r) { return fmtDate(r.d) + "," + r.p + "," + r.u; }).join("\n") + "\n";
  }

  var API = { DAY: DAY, Z: Z, parseCSV: parseCSV, buildSeries: buildSeries, fit: fit, fc: fc, backtest: backtest,
    recommend: recommend, makeSample: makeSample, toCSV: toCSV, fmtDate: fmtDate, dowOf: dowOf };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.DD = API;
})(typeof window !== "undefined" ? window : this);
