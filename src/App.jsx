import { useState, useEffect, useCallback } from "react";

const API = "https://ai-invest-agent-production.up.railway.app";

// ─── HELPERS ────────────────────────────────────────────────
const fmt = (v, decimals = 2) =>
  v === "" || v === null || v === undefined || isNaN(Number(v))
    ? "—"
    : Number(v).toFixed(decimals);

const fmtPct = (v) =>
  v === "" || v === null || v === undefined || isNaN(Number(v))
    ? "—"
    : `${(Number(v) * 100).toFixed(1)}%`;

const fmtPctDirect = (v) =>
  v === "" || v === null || v === undefined || isNaN(Number(v))
    ? "—"
    : `${Number(v).toFixed(1)}%`;

const fmtUSD = (v) =>
  v === "" || v === null || v === undefined || isNaN(Number(v))
    ? "—"
    : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const scoreColor = (score, max = 30) => {
  const ratio = score / max;
  if (ratio >= 0.65) return "green";
  if (ratio >= 0.35) return "yellow";
  return "red";
};

const today = new Date().toLocaleDateString("en-US", {
  weekday: "short", month: "short", day: "numeric", year: "numeric",
});

const alertIcons = {
  BUY_ZONE: "🟢",
  OVERHEATED: "🔥",
  HIGH_QUALITY: "💎",
  STRONG_COMPOSITE: "⚡",
  DCF_UPSIDE: "📈",
  DCF_OVERVALUED: "⚠️",
};

// ─── SIGNAL BADGE ────────────────────────────────────────────
function SignalBadge({ signal }) {
  const s = String(signal).toUpperCase();
  return <span className={`signal-badge ${s}`}>{s}</span>;
}

// ─── SCORE BAR ────────────────────────────────────────────────
function ScoreBar({ value, max = 30 }) {
  const pct = Math.min(100, (Number(value) / max) * 100);
  const color = scoreColor(value, max);
  return (
    <div className="score-bar-wrap">
      <span className="score-cell">{fmt(value, 1)}</span>
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} data-color={color} />
      </div>
    </div>
  );
}

// Inline style version for score bar fill colors
function ScoreBarInline({ value, max = 30 }) {
  const pct = Math.min(100, (Number(value) / max) * 100);
  const colors = { green: "#00e676", yellow: "#ffd740", red: "#ff5252" };
  const color = colors[scoreColor(value, max)];
  return (
    <div className="score-bar-wrap">
      <span className="score-cell">{fmt(value, 1)}</span>
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── LOADING ──────────────────────────────────────────────────
function Loading() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span>Načítám data...</span>
    </div>
  );
}

// ─── DAILY SCAN ───────────────────────────────────────────────
function DailyScan({ onSelectTicker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterSignal, setFilterSignal] = useState("ALL");
  const [sortKey, setSortKey] = useState("composite_score");
  const [sortDir, setSortDir] = useState(-1);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/daily-scan`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Backend nedostupný. Spusť FastAPI server na portu 8001."); setLoading(false); });
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="error-state">⚠️ {error}</div>;
  if (!data) return null;

  const stocks = data.top || [];
  const buyCount = stocks.filter((s) => s.signal === "BUY").length;
  const watchCount = stocks.filter((s) => s.signal === "WATCH").length;
  const avoidCount = stocks.filter((s) => s.signal === "AVOID").length;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(-1); }
  };

  const filtered = stocks
    .filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.ticker?.toLowerCase().includes(q) || s.company?.toLowerCase().includes(q);
      const matchSignal = filterSignal === "ALL" || s.signal === filterSignal;
      return matchSearch && matchSignal;
    })
    .sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return (av - bv) * sortDir;
    });

  const SortIcon = ({ k }) => sortKey === k ? (sortDir === -1 ? " ↓" : " ↑") : "";

  return (
    <div>
      <div className="page-header">
        <h2>Daily Scan</h2>
        <p>Automatická analýza akcií — signály, skóre a fundamenty</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-label">Celkem akcií</div>
          <div className="stat-value">{stocks.length}</div>
          <div className="stat-sub">v dnešním scanu</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">BUY signály</div>
          <div className="stat-value">{buyCount}</div>
          <div className="stat-sub">silné příležitosti</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">WATCH</div>
          <div className="stat-value">{watchCount}</div>
          <div className="stat-sub">sledovat</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">AVOID</div>
          <div className="stat-value">{avoidCount}</div>
          <div className="stat-sub">vyhnout se</div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="table-header">
          <h3>Výsledky scanu</h3>
          <div className="table-header-right">
            {["ALL", "BUY", "WATCH", "AVOID"].map((s) => (
              <button key={s} className={`filter-btn ${filterSignal === s ? "active" : ""}`} onClick={() => setFilterSignal(s)}>{s}</button>
            ))}
            <input
              className="search-input"
              placeholder="Hledat ticker nebo název..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>Žádné výsledky pro zadané filtry</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort("ticker")} className={sortKey === "ticker" ? "sort-active" : ""}>Ticker<SortIcon k="ticker" /></th>
                <th>Společnost</th>
                <th onClick={() => handleSort("price")} className={sortKey === "price" ? "sort-active" : ""}>Cena<SortIcon k="price" /></th>
                <th>Signál</th>
                <th onClick={() => handleSort("composite_score")} className={sortKey === "composite_score" ? "sort-active" : ""}>Composite<SortIcon k="composite_score" /></th>
                <th onClick={() => handleSort("quality_score")} className={sortKey === "quality_score" ? "sort-active" : ""}>Quality<SortIcon k="quality_score" /></th>
                <th onClick={() => handleSort("buy_score")} className={sortKey === "buy_score" ? "sort-active" : ""}>Buy Score<SortIcon k="buy_score" /></th>
                <th onClick={() => handleSort("overheat_score")} className={sortKey === "overheat_score" ? "sort-active" : ""}>Overheat<SortIcon k="overheat_score" /></th>
                <th>Sektor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.ticker} onClick={() => onSelectTicker(s.ticker)}>
                  <td><span className="ticker-cell">{s.ticker}</span></td>
                  <td><span className="company-cell">{s.company || "—"}</span></td>
                  <td><span className="price-cell">{s.price ? `$${Number(s.price).toFixed(2)}` : "—"}</span></td>
                  <td><SignalBadge signal={s.signal} /></td>
                  <td><ScoreBarInline value={s.composite_score} max={30} /></td>
                  <td><ScoreBarInline value={s.quality_score} max={14} /></td>
                  <td><ScoreBarInline value={s.buy_score} max={17} /></td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", color: Number(s.overheat_score) >= 4 ? "var(--red)" : Number(s.overheat_score) >= 2 ? "var(--yellow)" : "var(--text-dim)" }}>
                      {s.overheat_score ?? "—"}
                    </span>
                  </td>
                  <td><span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{s.sector || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── STOCK DETAIL ─────────────────────────────────────────────
function StockDetail({ ticker, onBack }) {
  const [data, setData] = useState(null);
  const [dcf, setDcf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/stock/${ticker}`).then((r) => r.json()),
      fetch(`${API}/stock/${ticker}/dcf`).then((r) => r.json()).catch(() => null),
    ])
      .then(([stock, dcfData]) => { setData(stock); setDcf(dcfData); setLoading(false); })
      .catch(() => { setError("Nepodařilo se načíst data akcie."); setLoading(false); });
  }, [ticker]);

  if (loading) return <Loading />;
  if (error) return <><button className="back-btn" onClick={onBack}>← Zpět</button><div className="error-state">{error}</div></>;
  if (!data) return null;

  const metricColor = (v, good, warn) => {
    const n = Number(v);
    if (isNaN(n)) return "neutral";
    if (n >= good) return "good";
    if (n >= warn) return "warn";
    return "bad";
  };

  const ratingClass = dcf?.rating === "Strong Buy" ? "strong-buy" : dcf?.rating === "Buy" ? "buy" : dcf?.rating === "Hold" ? "hold" : "risk";

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Zpět na Daily Scan</button>

      <div className="detail-hero">
        <div className="detail-hero-left">
          <h2>{data.ticker}</h2>
          <div className="company-name">{data.company || "—"}</div>
          {data.sector && <span className="sector-tag">{data.sector}</span>}
        </div>
        <div className="detail-hero-right">
          <div className="detail-price">{data.price ? `$${Number(data.price).toFixed(2)}` : "—"}</div>
          <div className="detail-signal" style={{ marginTop: 10 }}>
            <SignalBadge signal={data.signal || "WATCH"} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Skóre</div>
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">Composite Score</div>
          <div className={`metric-value ${metricColor(data.composite_score, 20, 14)}`}>{fmt(data.composite_score, 1)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Quality Score</div>
          <div className={`metric-value ${metricColor(data.quality_score, 9, 6)}`}>{fmt(data.quality_score, 1)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Buy Score</div>
          <div className={`metric-value ${metricColor(data.buy_score, 12, 8)}`}>{fmt(data.buy_score, 1)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Overheat Score</div>
          <div className={`metric-value ${Number(data.overheat_score) >= 4 ? "bad" : Number(data.overheat_score) >= 2 ? "warn" : "good"}`}>{fmt(data.overheat_score, 0)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Valuace</div>
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">EV / Sales</div>
          <div className={`metric-value ${metricColor(data.ev_to_sales, 0, 10, true)}`} style={{ color: Number(data.ev_to_sales) < 10 ? "var(--green)" : Number(data.ev_to_sales) < 20 ? "var(--yellow)" : "var(--red)" }}>{fmt(data.ev_to_sales, 1)}x</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">EV / FCF</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: Number(data.ev_to_fcf) < 25 ? "var(--green)" : Number(data.ev_to_fcf) < 50 ? "var(--yellow)" : "var(--red)" }}>{fmt(data.ev_to_fcf, 1)}x</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net Debt / EBITDA</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: Number(data.net_debt_to_ebitda) < 2 ? "var(--green)" : Number(data.net_debt_to_ebitda) < 4 ? "var(--yellow)" : "var(--red)" }}>{fmt(data.net_debt_to_ebitda, 1)}x</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Current Ratio</div>
          <div className={`metric-value ${metricColor(data.current_ratio, 2, 1)}`}>{fmt(data.current_ratio, 2)}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Kvalita & Růst</div>
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-label">ROIC</div>
          <div className={`metric-value ${metricColor(Number(data.roic) * 100, 20, 12)}`}>{fmtPct(data.roic)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Gross Margin</div>
          <div className={`metric-value ${metricColor(Number(data.gross_margin) * 100, 55, 35)}`}>{fmtPct(data.gross_margin)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">FCF Margin</div>
          <div className={`metric-value ${metricColor(Number(data.fcf_margin) * 100, 18, 10)}`}>{fmtPct(data.fcf_margin)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Revenue Growth</div>
          <div className={`metric-value ${metricColor(Number(data.revenue_growth) * 100, 15, 5)}`}>{fmtPct(data.revenue_growth)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">EPS Growth</div>
          <div className={`metric-value ${metricColor(Number(data.eps_growth) * 100, 15, 5)}`}>{fmtPct(data.eps_growth)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">6M Price Change</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: Number(data.change_6m) > 40 ? "var(--red)" : "var(--text)" }}>{fmtPctDirect(data.change_6m)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">1Y Price Change</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: Number(data.change_1y) > 70 ? "var(--red)" : "var(--text)" }}>{fmtPctDirect(data.change_1y)}</div>
        </div>
      </div>

      {dcf && (
        <>
          <div style={{ marginBottom: 12, color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em" }}>DCF Analýza</div>
          <div className="dcf-grid">
            <div className="dcf-summary-card">
              <h3>Fair Value</h3>
              <div className="dcf-values">
                <div className="dcf-row">
                  <span className="dcf-row-label">Aktuální cena</span>
                  <span className="dcf-row-value">{fmtUSD(dcf.current_price)}</span>
                </div>
                <div className="dcf-row">
                  <span className="dcf-row-label">Odhadovaná fair value</span>
                  <span className="dcf-row-value" style={{ color: "var(--accent)" }}>{fmtUSD(dcf.estimated_fair_value)}</span>
                </div>
                <div className="dcf-row">
                  <span className="dcf-row-label">Upside / Downside</span>
                  <span className="dcf-row-value" style={{ color: Number(dcf.upside_percent) > 0 ? "var(--green)" : "var(--red)" }}>
                    {dcf.upside_percent > 0 ? "+" : ""}{fmtPctDirect(dcf.upside_percent)}
                  </span>
                </div>
                <div className="dcf-row">
                  <span className="dcf-row-label">Rating</span>
                  <span className={`rating-badge ${ratingClass}`}>{dcf.rating}</span>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <h3>Projected FCF per Share</h3>
              {dcf.projected_fcf_per_share && (
                <div className="bar-chart" style={{ paddingBottom: 28 }}>
                  {dcf.projected_fcf_per_share.map((v, i) => {
                    const max = Math.max(...dcf.projected_fcf_per_share);
                    const pct = (v / max) * 100;
                    return (
                      <div key={i} className="bar-chart-bar" style={{ height: `${pct}%`, background: "var(--accent)" }}>
                        <span className="bar-value">${fmt(v, 2)}</span>
                        <span className="bar-label">Y{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {dcf.ai_comment && (
            <div className="ai-comment-box">
              <strong>🤖 AI komentář</strong>
              {dcf.ai_comment}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── PORTFOLIO ────────────────────────────────────────────────
function Portfolio() {
  const [positions, setPositions] = useState([{ ticker: "", shares: "", buy_price: "" }]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updatePosition = (i, field, value) => {
    const updated = [...positions];
    updated[i][field] = value;
    setPositions(updated);
  };
  const addPosition = () => setPositions([...positions, { ticker: "", shares: "", buy_price: "" }]);
  const removePosition = (i) => setPositions(positions.filter((_, idx) => idx !== i));

  const analyze = async () => {
    setLoading(true); setError(null); setResult(null);
    const valid = positions.filter((p) => p.ticker && p.shares && p.buy_price);
    if (!valid.length) { setError("Vyplň alespoň jednu pozici."); setLoading(false); return; }
    try {
      const r = await fetch(`${API}/portfolio/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio: valid.map((p) => ({ ticker: p.ticker.toUpperCase(), shares: Number(p.shares), buy_price: Number(p.buy_price) })) }),
      });
      const d = await r.json();
      setResult(d);
    } catch {
      setError("Nepodařilo se analyzovat portfolio.");
    }
    setLoading(false);
  };

  const summary = result?.portfolio_summary;

  return (
    <div>
      <div className="page-header">
        <h2>Portfolio Analyzer</h2>
        <p>Zadej své pozice a získej AI analýzu portfolia</p>
      </div>

      <div className="portfolio-form">
        <h3>Pozice</h3>
        <div className="positions-list">
          <div className="position-row" style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", paddingBottom: 4 }}>
            <span>Ticker</span><span>Počet akcií</span><span>Nákupní cena ($)</span><span></span>
          </div>
          {positions.map((p, i) => (
            <div className="position-row" key={i}>
              <input className="form-input" placeholder="AAPL" value={p.ticker} onChange={(e) => updatePosition(i, "ticker", e.target.value)} style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }} />
              <input className="form-input" placeholder="10" type="number" value={p.shares} onChange={(e) => updatePosition(i, "shares", e.target.value)} />
              <input className="form-input" placeholder="150.00" type="number" value={p.buy_price} onChange={(e) => updatePosition(i, "buy_price", e.target.value)} />
              {positions.length > 1 && <button className="btn-icon" onClick={() => removePosition(i)}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary" onClick={addPosition}>+ Přidat pozici</button>
          <button className="btn-primary" onClick={analyze} disabled={loading}>{loading ? "Analyzuji..." : "Analyzovat portfolio"}</button>
        </div>
      </div>

      {error && <div className="error-state">⚠️ {error}</div>}

      {result && summary && (
        <>
          <div className="portfolio-summary">
            <div className="stat-card accent">
              <div className="stat-label">Celková hodnota</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{fmtUSD(summary.total_value)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Investováno</div>
              <div className="stat-value" style={{ fontSize: 22, color: "var(--text)" }}>{fmtUSD(summary.total_cost)}</div>
            </div>
            <div className={`stat-card ${summary.total_profit >= 0 ? "green" : "red"}`}>
              <div className="stat-label">Zisk / Ztráta</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{summary.total_profit >= 0 ? "+" : ""}{fmtUSD(summary.total_profit)}</div>
              <div className="stat-sub">{summary.total_profit_pct >= 0 ? "+" : ""}{fmtPctDirect(summary.total_profit_pct)}</div>
            </div>
            <div className="stat-card yellow">
              <div className="stat-label">Portfolio Score</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{fmt(summary.portfolio_score, 1)}</div>
            </div>
          </div>

          {result.ai_comment && (
            <div className="ai-comment-box">
              <strong>🤖 AI komentář</strong>
              {result.ai_comment}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="table-wrapper">
              <div className="table-header"><h3>Pozice</h3></div>
              <table>
                <thead>
                  <tr>
                    <th>Ticker</th><th>Cena</th><th>Hodnota</th><th>P/L</th><th>Signál</th>
                  </tr>
                </thead>
                <tbody>
                  {result.positions.map((p) => (
                    <tr key={p.ticker}>
                      <td><span className="ticker-cell">{p.ticker}</span></td>
                      <td><span className="price-cell">{fmtUSD(p.current_price)}</span></td>
                      <td><span className="price-cell">{fmtUSD(p.current_value)}</span></td>
                      <td><span style={{ fontFamily: "var(--font-mono)", color: p.profit_loss >= 0 ? "var(--green)" : "var(--red)" }}>{p.profit_loss >= 0 ? "+" : ""}{fmtPctDirect(p.profit_loss_pct)}</span></td>
                      <td><SignalBadge signal={p.signal || "WATCH"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="dcf-summary-card">
              <h3>Sektorová diverzifikace</h3>
              <div className="sector-list">
                {result.sector_diversification.map((s) => (
                  <div className="sector-row" key={s.sector}>
                    <div className="sector-row-header">
                      <span className="sector-row-label">{s.sector}</span>
                      <span className="sector-row-value">{fmtPctDirect(s.weight_pct)}</span>
                    </div>
                    <div className="sector-progress">
                      <div className="sector-progress-fill" style={{ width: `${s.weight_pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── WATCHLIST ────────────────────────────────────────────────
function Watchlist() {
  const [input, setInput] = useState("");
  const [tickers, setTickers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t)) { setTickers([...tickers, t]); }
    setInput("");
  };
  const removeTicker = (t) => setTickers(tickers.filter((x) => x !== t));

  const analyze = async () => {
    if (!tickers.length) { setError("Přidej alespoň jeden ticker."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch(`${API}/watchlist/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      const d = await r.json();
      setResult(d);
    } catch {
      setError("Nepodařilo se analyzovat watchlist.");
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Watchlist</h2>
        <p>Sleduj a analyzuj vybrané akcie</p>
      </div>

      <div className="watchlist-input-area">
        <h3>Přidat tickery</h3>
        <div className="ticker-tags">
          {tickers.map((t) => (
            <span className="ticker-tag" key={t}>{t} <span className="remove-tag" onClick={() => removeTicker(t)}>×</span></span>
          ))}
        </div>
        <div className="watchlist-input-row">
          <input className="form-input" style={{ maxWidth: 160, fontFamily: "var(--font-mono)", textTransform: "uppercase" }} placeholder="AAPL" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTicker()} />
          <button className="btn-secondary" onClick={addTicker}>+ Přidat</button>
          <button className="btn-primary" onClick={analyze} disabled={loading || !tickers.length}>{loading ? "Analyzuji..." : "Analyzovat"}</button>
        </div>
      </div>

      {error && <div className="error-state">⚠️ {error}</div>}

      {result && (
        <div className="table-wrapper">
          <div className="table-header"><h3>{result.count} akcií analyzováno</h3></div>
          {result.items.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><p>Žádné výsledky</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ticker</th><th>Společnost</th><th>Cena</th><th>Signál</th>
                  <th>Composite</th><th>Quality</th><th>ROIC</th><th>Gross Margin</th><th>FCF Margin</th><th>Rev. Growth</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((s) => (
                  <tr key={s.ticker}>
                    <td><span className="ticker-cell">{s.ticker}</span></td>
                    <td><span className="company-cell">{s.company || "—"}</span></td>
                    <td><span className="price-cell">{s.price ? `$${Number(s.price).toFixed(2)}` : "—"}</span></td>
                    <td><SignalBadge signal={s.signal || "WATCH"} /></td>
                    <td><ScoreBarInline value={s.composite_score} max={30} /></td>
                    <td><ScoreBarInline value={s.quality_score} max={14} /></td>
                    <td style={{ fontFamily: "var(--font-mono)", color: Number(s.roic) > 0.15 ? "var(--green)" : "var(--text)" }}>{fmtPct(s.roic)}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{fmtPct(s.gross_margin)}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{fmtPct(s.fcf_margin)}</td>
                    <td style={{ fontFamily: "var(--font-mono)", color: Number(s.revenue_growth) > 0.15 ? "var(--green)" : "var(--text)" }}>{fmtPct(s.revenue_growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ALERTS ───────────────────────────────────────────────────
function Alerts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch(`${API}/alerts`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Nepodařilo se načíst alerty."); setLoading(false); });
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="error-state">⚠️ {error}</div>;
  if (!data) return null;

  const alerts = data.alerts || [];
  const types = ["ALL", ...new Set(alerts.map((a) => a.type))];
  const filtered = filter === "ALL" ? alerts : alerts.filter((a) => a.type === filter);

  return (
    <div>
      <div className="page-header">
        <h2>Alerts</h2>
        <p>Automaticky generované signály a upozornění</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {["BUY_ZONE", "OVERHEATED", "HIGH_QUALITY", "STRONG_COMPOSITE"].map((type) => {
          const count = alerts.filter((a) => a.type === type).length;
          const colors = { BUY_ZONE: "green", OVERHEATED: "red", HIGH_QUALITY: "accent", STRONG_COMPOSITE: "yellow" };
          return (
            <div className={`stat-card ${colors[type]}`} key={type} style={{ cursor: "pointer" }} onClick={() => setFilter(filter === type ? "ALL" : type)}>
              <div className="stat-label">{type.replace("_", " ")}</div>
              <div className="stat-value">{count}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {types.map((t) => (
          <button key={t} className={`filter-btn ${filter === t ? "active" : ""}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🔕</div><p>Žádné alerty pro tento filtr</p></div>
      ) : (
        <div className="alerts-grid">
          {filtered.map((a, i) => (
            <div className="alert-card" key={i}>
              <div className={`alert-icon ${a.type}`}>{alertIcons[a.type] || "📌"}</div>
              <div className="alert-body">
                <div className="alert-ticker">{a.ticker} {a.company && <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 12 }}>— {a.company}</span>}</div>
                <div className="alert-message">{a.message}</div>
              </div>
              <span className={`alert-type-badge ${a.type}`}>{a.type.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────
const NAV = [
  { id: "scan", label: "Daily Scan", icon: "📊" },
  { id: "stock", label: "Stock Detail", icon: "🔍" },
  { id: "portfolio", label: "Portfolio", icon: "💼" },
  { id: "watchlist", label: "Watchlist", icon: "👁" },
  { id: "alerts", label: "Alerts", icon: "🔔" },
];

const PAGE_TITLES = {
  scan: "Daily Scan",
  stock: "Stock Detail",
  portfolio: "Portfolio Analyzer",
  watchlist: "Watchlist",
  alerts: "Alerts",
};

export default function App() {
  const [page, setPage] = useState("scan");
  const [selectedTicker, setSelectedTicker] = useState(null);

  const handleSelectTicker = (ticker) => {
    setSelectedTicker(ticker);
    setPage("stock");
  };

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">AI Invest</div>
          <h1>Agent<span>.</span></h1>
        </div>
        <div className="nav-section-label">Navigace</div>
        {NAV.map((item) => (
          <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </div>
        ))}
        <div className="sidebar-footer">
          <div className="status-dot">
            <span className="dot" />
            Backend {page === "scan" ? "live" : "connected"}
          </div>
        </div>
      </nav>

      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">{PAGE_TITLES[page]}</div>
          <div className="topbar-right">
            <span className="topbar-date">{today}</span>
          </div>
        </div>

        <div className="page-content">
          {page === "scan" && <DailyScan onSelectTicker={handleSelectTicker} />}
          {page === "stock" && selectedTicker && <StockDetail ticker={selectedTicker} onBack={() => setPage("scan")} />}
          {page === "stock" && !selectedTicker && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>Klikni na ticker v Daily Scan pro zobrazení detailu</p>
              <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => setPage("scan")}>Přejít na Daily Scan</button>
            </div>
          )}
          {page === "portfolio" && <Portfolio />}
          {page === "watchlist" && <Watchlist />}
          {page === "alerts" && <Alerts />}
        </div>
      </div>
    </>
  );
}
