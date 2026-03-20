import { useState, useEffect, useCallback, useRef } from 'react'

const API = 'https://ai-invest-agent-production.up.railway.app'

const fmt = v => (v == null ? '–' : Number(v).toFixed(2))
const fmtPct = v => (v == null ? '–' : `${Number(v).toFixed(1)}%`)
const fmtUSD = v => (v == null ? '–' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const scoreBarClass = v => v >= 70 ? 'green' : v >= 40 ? 'yellow' : 'red'
const scoreBarClassInv = v => v > 70 ? 'red' : v > 40 ? 'yellow' : 'green'

const dnesniDatum = () => new Date().toLocaleDateString('cs-CZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

/* ─── SMALL COMPONENTS ─────────────────────────── */
function SignalBadge({ signal }) {
  const icons = { BUY: '▲', WATCH: '◆', AVOID: '▼' }
  const labels = { BUY: 'Koupit', WATCH: 'Sledovat', AVOID: 'Vyhnout' }
  return (
    <span className={`signal-badge ${signal || 'WATCH'}`}>
      {icons[signal] || '◆'} {labels[signal] || signal}
    </span>
  )
}

function ScoreBar({ value, inverted = false }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  const cls = inverted ? scoreBarClassInv(pct) : scoreBarClass(pct)
  const color = cls === 'green' ? 'var(--green)' : cls === 'yellow' ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className="score-bar-wrap">
      <span className="score-cell" style={{ color }}>{fmt(value)}</span>
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function Nacitani({ text = 'Načítám data...' }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <span>{text}</span>
    </div>
  )
}

function Chyba({ text }) {
  return <div className="error-state">⚠ {text}</div>
}

/* ─── PAGE 1: PŘEHLED ───────────────────────────── */
function Prehled({ onSelectStock, onNavigate }) {
  const [data, setData] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/daily-scan`).then(r => r.json()),
      fetch(`${API}/alerts`).then(r => r.json()).catch(() => [])
    ])
      .then(([scanData, alertsData]) => {
        setData(scanData)
        setAlerts(Array.isArray(alertsData) ? alertsData : (alertsData?.alerts || []))
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <Nacitani text="Načítám přehled trhu..." />
  if (error) return <Chyba text={error} />

  const stocks = [...(data?.stocks || data || [])].sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
  const buyCount = stocks.filter(s => s.signal === 'BUY').length
  const watchCount = stocks.filter(s => s.signal === 'WATCH').length
  const avoidCount = stocks.filter(s => s.signal === 'AVOID').length
  const avgScore = stocks.length ? (stocks.reduce((a, s) => a + (s.composite_score || 0), 0) / stocks.length).toFixed(1) : 0
  const topStock = stocks[0]

  return (
    <>
      <div className="page-header">
        <h2>Přehled trhu</h2>
        <p>Aktuální situace na trhu · {dnesniDatum()}</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-header"><span className="kpi-label">Akcií v databázi</span><span className="kpi-icon blue">📊</span></div>
          <div className="kpi-value">{stocks.length}</div>
          <div className="kpi-footer"><span className="kpi-sub">analyzováno dnes</span></div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-header"><span className="kpi-label">Signál KOUPIT</span><span className="kpi-icon green">📈</span></div>
          <div className="kpi-value">{buyCount}</div>
          <div className="kpi-footer"><span className="kpi-sub">{stocks.length ? ((buyCount / stocks.length * 100).toFixed(0)) : 0}% ze všech</span></div>
        </div>
        <div className="kpi-card yellow">
          <div className="kpi-header"><span className="kpi-label">Sledovat</span><span className="kpi-icon yellow">👁</span></div>
          <div className="kpi-value">{watchCount}</div>
          <div className="kpi-footer"><span className="kpi-sub">akcií ke sledování</span></div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-header"><span className="kpi-label">Vyhnout se</span><span className="kpi-icon red">⚠️</span></div>
          <div className="kpi-value">{avoidCount}</div>
          <div className="kpi-footer"><span className="kpi-sub">nevhodné k nákupu</span></div>
        </div>
        <div className="kpi-card teal">
          <div className="kpi-header"><span className="kpi-label">Průměrné skóre</span><span className="kpi-icon teal">🎯</span></div>
          <div className="kpi-value">{avgScore}</div>
          <div className="kpi-footer"><span className="kpi-sub">kompozitní score</span></div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-header"><span className="kpi-label">Upozornění</span><span className="kpi-icon purple">🔔</span></div>
          <div className="kpi-value">{alerts.length}</div>
          <div className="kpi-footer">
            <span className="kpi-sub" style={{ cursor: 'pointer', color: 'var(--purple)' }} onClick={() => onNavigate('upozorneni')}>zobrazit vše →</span>
          </div>
        </div>
      </div>

      <div className="overview-row">
        <div className="top-stocks-card">
          <div className="card-header">
            <h3>🏆 Top akcie dle skóre</h3>
            <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => onNavigate('denniSken')}>Zobrazit vše →</button>
          </div>
          <table className="mini-table">
            <thead><tr><th>Ticker</th><th>Název</th><th>Cena</th><th>Skóre</th><th>Signál</th></tr></thead>
            <tbody>
              {stocks.slice(0, 8).map(s => (
                <tr key={s.ticker} onClick={() => { onSelectStock(s.ticker); onNavigate('analyza') }} style={{ cursor: 'pointer' }}>
                  <td><span className="ticker-cell">{s.ticker}</span></td>
                  <td><span className="company-cell">{s.company}</span></td>
                  <td><span className="price-cell">{fmtUSD(s.price)}</span></td>
                  <td><ScoreBar value={s.composite_score} /></td>
                  <td><SignalBadge signal={s.signal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="market-signal-card">
          <h3>📡 Tržní sentiment</h3>
          {stocks.length > 0 && (
            <div className="sentiment-meter">
              {[
                { label: '▲ Koupit', count: buyCount, cls: 'buy-color', color: 'var(--green)' },
                { label: '◆ Sledovat', count: watchCount, cls: 'watch-color', color: 'var(--yellow)' },
                { label: '▼ Vyhnout', count: avoidCount, cls: 'avoid-color', color: 'var(--red)' },
              ].map(item => (
                <div key={item.label} className="sentiment-item">
                  <div className="sentiment-label">
                    <span className="sentiment-name">{item.label}</span>
                    <span className="sentiment-pct" style={{ color: item.color }}>{((item.count / stocks.length) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="sentiment-bar">
                    <div className={`sentiment-bar-fill ${item.cls}`} style={{ width: `${(item.count / stocks.length) * 100}%` }} />
                  </div>
                </div>
              ))}
              {topStock && (
                <div style={{ marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Nejlepší akcie</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>{topStock.ticker}</span>
                    <SignalBadge signal={topStock.signal} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>{topStock.company}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginTop: '4px' }}>Skóre: {fmt(topStock.composite_score)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3>🔔 Poslední upozornění</h3>
            <button className="btn-secondary" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => onNavigate('upozorneni')}>Všechna →</button>
          </div>
          <div style={{ padding: '14px' }}>
            <div className="alerts-grid">
              {alerts.slice(0, 4).map((a, i) => (
                <div key={i} className="alert-card">
                  <div className={`alert-icon ${a.type}`}>
                    {a.type === 'BUY_ZONE' || a.type === 'DCF_UPSIDE' ? '🟢' : a.type === 'OVERHEATED' || a.type === 'DCF_OVERVALUED' ? '🔴' : a.type === 'HIGH_QUALITY' ? '🟣' : '🔵'}
                  </div>
                  <div className="alert-body">
                    <div className="alert-ticker">{a.ticker}</div>
                    <div className="alert-message">{a.message}</div>
                  </div>
                  <span className={`alert-type-badge ${a.type}`}>{a.type?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── PAGE 2: DENNÍ SKEN ────────────────────────── */
function DenniSken({ onSelectStock, onNavigate }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('VSE')
  const [sortKey, setSortKey] = useState('composite_score')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/daily-scan`)
      .then(r => r.json())
      .then(d => { setStocks(d?.stocks || d || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const handleSort = key => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const filtered = stocks
    .filter(s => filter === 'VSE' || s.signal === filter)
    .filter(s => !search || s.ticker?.toLowerCase().includes(search.toLowerCase()) || s.company?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const buyCount = stocks.filter(s => s.signal === 'BUY').length
  const watchCount = stocks.filter(s => s.signal === 'WATCH').length
  const avoidCount = stocks.filter(s => s.signal === 'AVOID').length

  return (
    <>
      <div className="page-header">
        <h2>Denní sken akcií</h2>
        <p>Automatická analýza celé databáze akcií · {stocks.length} výsledků</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-header"><span className="kpi-label">Celkem akcií</span><span className="kpi-icon blue">📋</span></div>
          <div className="kpi-value">{stocks.length}</div>
          <div className="kpi-footer"><span className="kpi-sub">v dnešním skenu</span></div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-header"><span className="kpi-label">BUY signály</span><span className="kpi-icon green">✅</span></div>
          <div className="kpi-value">{buyCount}</div>
          <div className="kpi-footer"><span className="kpi-sub">vhodné k nákupu</span></div>
        </div>
        <div className="kpi-card yellow">
          <div className="kpi-header"><span className="kpi-label">Sledovat</span><span className="kpi-icon yellow">👁</span></div>
          <div className="kpi-value">{watchCount}</div>
          <div className="kpi-footer"><span className="kpi-sub">čekat na signál</span></div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-header"><span className="kpi-label">Vyhnout se</span><span className="kpi-icon red">🚫</span></div>
          <div className="kpi-value">{avoidCount}</div>
          <div className="kpi-footer"><span className="kpi-sub">rizikové akcie</span></div>
        </div>
      </div>

      {error && <Chyba text={error} />}

      <div className="table-wrapper">
        <div className="table-header">
          <h3>📊 Přehled akcií</h3>
          <div className="table-header-right">
            <input className="search-input" placeholder="🔍  Hledat ticker / název..." value={search} onChange={e => setSearch(e.target.value)} />
            {[['VSE', 'Vše'], ['BUY', 'Koupit'], ['WATCH', 'Sledovat'], ['AVOID', 'Vyhnout']].map(([f, l]) => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{l}</button>
            ))}
          </div>
        </div>
        {loading ? <Nacitani /> : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('ticker')} className={sortKey === 'ticker' ? 'sort-active' : ''}>Ticker ↕</th>
                <th>Název společnosti</th>
                <th onClick={() => handleSort('price')} className={sortKey === 'price' ? 'sort-active' : ''}>Cena ↕</th>
                <th onClick={() => handleSort('composite_score')} className={sortKey === 'composite_score' ? 'sort-active' : ''}>Kompozit ↕</th>
                <th onClick={() => handleSort('quality_score')} className={sortKey === 'quality_score' ? 'sort-active' : ''}>Kvalita ↕</th>
                <th onClick={() => handleSort('buy_score')} className={sortKey === 'buy_score' ? 'sort-active' : ''}>Buy ↕</th>
                <th onClick={() => handleSort('overheat_score')} className={sortKey === 'overheat_score' ? 'sort-active' : ''}>Přehřátí ↕</th>
                <th>Signál</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Žádné akcie neodpovídají filtru</td></tr>
              ) : filtered.map(s => (
                <tr key={s.ticker} onClick={() => { onSelectStock(s.ticker); onNavigate('analyza') }} style={{ cursor: 'pointer' }}>
                  <td><span className="ticker-cell">{s.ticker}</span></td>
                  <td><span className="company-cell">{s.company}</span></td>
                  <td><span className="price-cell">{fmtUSD(s.price)}</span></td>
                  <td><ScoreBar value={s.composite_score} /></td>
                  <td><ScoreBar value={s.quality_score} /></td>
                  <td><ScoreBar value={s.buy_score} /></td>
                  <td><ScoreBar value={s.overheat_score} inverted /></td>
                  <td><SignalBadge signal={s.signal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

/* ─── PAGE 3: ANALÝZA AKCIE ─────────────────────── */
function AnalyzaAkcii({ preselectedTicker, onClear }) {
  const [inputVal, setInputVal] = useState(preselectedTicker || '')
  const [ticker, setTicker] = useState('')
  const [stockData, setStockData] = useState(null)
  const [dcfData, setDcfData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analyze = useCallback((t) => {
    const sym = (t || inputVal).trim().toUpperCase()
    if (!sym) return
    setTicker(sym)
    setLoading(true)
    setError('')
    setStockData(null)
    setDcfData(null)
    Promise.all([
      fetch(`${API}/stock/${sym}`).then(r => r.json()),
      fetch(`${API}/stock/${sym}/dcf`).then(r => r.json()).catch(() => null)
    ])
      .then(([sData, dData]) => { setStockData(sData); setDcfData(dData); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [inputVal])

  useEffect(() => {
    if (preselectedTicker) { setInputVal(preselectedTicker); analyze(preselectedTicker) }
  }, [preselectedTicker])

  const s = stockData
  const dcf = dcfData

  return (
    <>
      <div className="page-header">
        <h2>Analýza akcie</h2>
        <p>Detailní fundamentální analýza konkrétní akcie</p>
      </div>

      <div className="section-card" style={{ marginBottom: '20px' }}>
        <div className="section-header"><h3>🔍 Vyhledat akcii</h3></div>
        <div style={{ padding: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input className="form-input" style={{ maxWidth: '280px' }} placeholder="Zadejte ticker (např. AAPL, MSFT)"
            value={inputVal} onChange={e => setInputVal(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && analyze()} />
          <button className="btn-primary" onClick={() => analyze()} disabled={loading || !inputVal.trim()}>
            {loading ? '⏳ Analyzuji...' : '🔍 Analyzovat'}
          </button>
          {s && <button className="btn-secondary" onClick={() => { setStockData(null); setDcfData(null); setTicker(''); setInputVal(''); onClear?.() }}>✕ Vymazat</button>}
        </div>
      </div>

      {error && <Chyba text={error} />}
      {loading && <Nacitani text={`Analyzuji ${ticker}...`} />}

      {s && !loading && (
        <>
          <div className="detail-hero">
            <div className="detail-hero-left">
              <h2>{s.ticker}</h2>
              <div className="company-name">{s.company}</div>
              {s.sector && <span className="sector-tag">{s.sector}</span>}
            </div>
            <div className="detail-hero-right">
              <div className="detail-price">{fmtUSD(s.price)}</div>
              <div className="detail-signal"><SignalBadge signal={s.signal} /></div>
            </div>
          </div>

          <div className="kpi-grid" style={{ marginBottom: '18px' }}>
            {[
              { label: 'Kompozitní skóre', val: s.composite_score, icon: '🎯', cls: 'blue' },
              { label: 'Skóre kvality', val: s.quality_score, icon: '⭐', cls: 'teal' },
              { label: 'Buy skóre', val: s.buy_score, icon: '📈', cls: 'green' },
              { label: 'Skóre přehřátí', val: s.overheat_score, icon: '🌡', cls: 'red' },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.cls}`}>
                <div className="kpi-header"><span className="kpi-label">{k.label}</span><span className={`kpi-icon ${k.cls}`}>{k.icon}</span></div>
                <div className="kpi-value">{fmt(k.val)}</div>
                <div className="kpi-footer"><span className="kpi-sub">z 100 bodů</span></div>
              </div>
            ))}
          </div>

          <div className="two-col">
            <div>
              <div className="section-card">
                <div className="section-header"><h3>💰 Ocenění</h3></div>
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'EV/Sales', val: s.ev_sales },
                      { label: 'EV/FCF', val: s.ev_fcf },
                      { label: 'Net Debt/EBITDA', val: s.net_debt_ebitda },
                      { label: 'Current Ratio', val: s.current_ratio },
                    ].map(m => (
                      <div key={m.label} className="metric-card">
                        <div className="metric-label">{m.label}</div>
                        <div className="metric-value neutral">{fmt(m.val)}×</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="section-card">
                <div className="section-header"><h3>🏆 Kvalita firmy</h3></div>
                <div style={{ padding: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'ROIC', val: s.roic },
                      { label: 'Hrubá marže', val: s.gross_margin },
                      { label: 'FCF marže', val: s.fcf_margin },
                      { label: 'Růst výnosů', val: s.revenue_growth },
                    ].map(m => (
                      <div key={m.label} className="metric-card">
                        <div className="metric-label">{m.label}</div>
                        <div className={`metric-value ${(m.val || 0) > 15 ? 'good' : (m.val || 0) > 0 ? 'warn' : 'bad'}`}>
                          {fmtPct(m.val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              {dcf && (
                <div className="section-card">
                  <div className="section-header"><h3>📐 DCF Ocenění</h3></div>
                  <div style={{ padding: '18px' }}>
                    <div className="dcf-values">
                      {[
                        { label: 'Aktuální cena', val: fmtUSD(dcf.current_price) },
                        { label: 'Férová hodnota DCF', val: fmtUSD(dcf.fair_value), color: 'var(--primary)' },
                        { label: 'Potenciál růstu', val: `${(dcf.upside_pct || 0) >= 0 ? '+' : ''}${fmtPct(dcf.upside_pct)}`, color: (dcf.upside_pct || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
                      ].map((row, i) => (
                        <div key={i} className="dcf-row">
                          <span className="dcf-row-label">{row.label}</span>
                          <span className="dcf-row-value" style={{ color: row.color || 'var(--text)' }}>{row.val}</span>
                        </div>
                      ))}
                      <div className="dcf-row">
                        <span className="dcf-row-label">Hodnocení DCF</span>
                        <span className={`rating-badge ${(dcf.rating || '').toLowerCase().replace(' ', '-')}`}>
                          {dcf.rating === 'STRONG BUY' ? 'SILNÝ NÁKUP' : dcf.rating === 'BUY' ? 'NÁKUP' : dcf.rating === 'HOLD' ? 'DRŽET' : dcf.rating || '–'}
                        </span>
                      </div>
                    </div>
                    {dcf.projected_fcf?.length > 0 && (
                      <div style={{ marginTop: '18px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Projekce FCF</div>
                        <div className="bar-chart">
                          {(() => {
                            const maxV = Math.max(...dcf.projected_fcf.map(v => Math.abs(v)))
                            return dcf.projected_fcf.slice(0, 6).map((v, i) => (
                              <div key={i} className="bar-chart-bar" style={{ height: `${(Math.abs(v) / maxV) * 100}%`, background: v >= 0 ? 'var(--primary)' : 'var(--red)', opacity: 0.82 }}>
                                <span className="bar-value">{(v / 1e9).toFixed(1)}B</span>
                                <span className="bar-label">R{i + 1}</span>
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {s.ai_commentary && (
                <div className="ai-comment-box">
                  <div className="ai-label">🤖 AI Komentář</div>
                  {s.ai_commentary}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!s && !loading && !error && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>Zadejte ticker akcie výše pro zahájení analýzy</p>
          <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Např. AAPL, MSFT, GOOGL, NVDA, TSLA...</p>
        </div>
      )}
    </>
  )
}

/* ─── PAGE 4: PORTFOLIO ─────────────────────────── */
function Portfolio() {
  const [positions, setPositions] = useState([{ ticker: '', shares: '', buyPrice: '' }])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updatePos = (i, field, val) => {
    const next = [...positions]; next[i] = { ...next[i], [field]: val }; setPositions(next)
  }

  const analyze = () => {
    const valid = positions.filter(p => p.ticker && p.shares && p.buyPrice)
    if (!valid.length) return
    setLoading(true); setError('')
    fetch(`${API}/portfolio/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: valid.map(p => ({ ticker: p.ticker.toUpperCase(), shares: Number(p.shares), buy_price: Number(p.buyPrice) })) })
    })
      .then(r => r.json())
      .then(d => { setResult(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  const r = result

  return (
    <>
      <div className="page-header">
        <h2>Správa portfolia</h2>
        <p>Analyzujte své investiční portfolio a sledujte výkonnost pozic</p>
      </div>

      {r && (
        <div className="kpi-grid">
          <div className="kpi-card blue">
            <div className="kpi-header"><span className="kpi-label">Celková hodnota</span><span className="kpi-icon blue">💼</span></div>
            <div className="kpi-value" style={{ fontSize: '22px' }}>{fmtUSD(r.total_value)}</div>
            <div className="kpi-footer"><span className="kpi-sub">aktuální tržní hodnota</span></div>
          </div>
          <div className="kpi-card" style={{ borderColor: (r.total_pnl || 0) >= 0 ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.35)' }}>
            <div className="kpi-header">
              <span className="kpi-label">Celkový P&L</span>
              <span className="kpi-icon" style={{ background: (r.total_pnl || 0) >= 0 ? 'var(--green-dim)' : 'var(--red-dim)' }}>{(r.total_pnl || 0) >= 0 ? '📈' : '📉'}</span>
            </div>
            <div className="kpi-value" style={{ fontSize: '22px', color: (r.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {(r.total_pnl || 0) >= 0 ? '+' : ''}{fmtUSD(r.total_pnl)}
            </div>
            <div className="kpi-footer"><span className="kpi-sub">{fmtPct(r.total_pnl_pct)} celkem</span></div>
          </div>
          <div className="kpi-card teal">
            <div className="kpi-header"><span className="kpi-label">Počet pozic</span><span className="kpi-icon teal">📋</span></div>
            <div className="kpi-value">{r.positions?.length || 0}</div>
            <div className="kpi-footer"><span className="kpi-sub">aktivní pozice</span></div>
          </div>
          <div className="kpi-card yellow">
            <div className="kpi-header"><span className="kpi-label">Diverzifikace</span><span className="kpi-icon yellow">🗂</span></div>
            <div className="kpi-value">{r.sectors?.length || 0}</div>
            <div className="kpi-footer"><span className="kpi-sub">sektorů v portfoliu</span></div>
          </div>
        </div>
      )}

      <div className="portfolio-form">
        <h3>➕ Přidat pozice</h3>
        <div className="positions-list">
          {positions.map((p, i) => (
            <div key={i} className="position-row">
              <input className="form-input" placeholder="Ticker (AAPL)" value={p.ticker} onChange={e => updatePos(i, 'ticker', e.target.value.toUpperCase())} />
              <input className="form-input" placeholder="Počet akcií" type="number" value={p.shares} onChange={e => updatePos(i, 'shares', e.target.value)} />
              <input className="form-input" placeholder="Nákupní cena ($)" type="number" value={p.buyPrice} onChange={e => updatePos(i, 'buyPrice', e.target.value)} />
              {positions.length > 1 && <button className="btn-icon" onClick={() => setPositions(p => p.filter((_, idx) => idx !== i))}>✕</button>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => setPositions(p => [...p, { ticker: '', shares: '', buyPrice: '' }])}>+ Přidat pozici</button>
          <button className="btn-primary" onClick={analyze} disabled={loading || !positions.some(p => p.ticker && p.shares && p.buyPrice)}>
            {loading ? '⏳ Analyzuji...' : '📊 Analyzovat portfolio'}
          </button>
        </div>
      </div>

      {error && <Chyba text={error} />}

      {r && (
        <>
          {r.ai_commentary && (
            <div className="ai-comment-box">
              <div className="ai-label">🤖 AI hodnocení portfolia</div>
              {r.ai_commentary}
            </div>
          )}
          <div className="two-col">
            <div className="table-wrapper" style={{ marginBottom: 0 }}>
              <div className="table-header"><h3>📋 Pozice v portfoliu</h3></div>
              <table>
                <thead>
                  <tr><th>Ticker</th><th>Akcie</th><th>Nák. cena</th><th>Akt. cena</th><th>P&L</th><th>Signál</th></tr>
                </thead>
                <tbody>
                  {(r.positions || []).map(p => (
                    <tr key={p.ticker}>
                      <td><span className="ticker-cell">{p.ticker}</span></td>
                      <td>{p.shares}</td>
                      <td>{fmtUSD(p.buy_price)}</td>
                      <td>{fmtUSD(p.current_price)}</td>
                      <td style={{ color: (p.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                        {(p.pnl || 0) >= 0 ? '+' : ''}{fmtUSD(p.pnl)} ({fmtPct(p.pnl_pct)})
                      </td>
                      <td><SignalBadge signal={p.signal} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {r.sectors?.length > 0 && (
              <div className="section-card" style={{ marginBottom: 0 }}>
                <div className="section-header"><h3>🗂 Sektorová diverzifikace</h3></div>
                <div style={{ padding: '16px' }}>
                  <div className="sector-list">
                    {r.sectors.map((sec, i) => (
                      <div key={i} className="sector-row">
                        <div className="sector-row-header">
                          <span className="sector-row-label">{sec.sector}</span>
                          <span className="sector-row-value">{fmtPct(sec.weight)}</span>
                        </div>
                        <div className="sector-progress">
                          <div className="sector-progress-fill" style={{ width: `${sec.weight}%`, background: ['var(--primary)', 'var(--teal)', 'var(--purple)', 'var(--green)', 'var(--yellow)'][i % 5] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!r && !loading && !error && (
        <div className="empty-state">
          <div className="empty-icon">💼</div>
          <p>Přidejte pozice výše a spusťte analýzu portfolia</p>
        </div>
      )}
    </>
  )
}

/* ─── PAGE 5: SLEDOVANÝ SEZNAM ──────────────────── */
function SledovanySenam() {
  const [tickers, setTickers] = useState(['AAPL', 'MSFT', 'NVDA'])
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addTicker = () => {
    const t = input.trim().toUpperCase()
    if (t && !tickers.includes(t)) setTickers(p => [...p, t])
    setInput('')
  }

  const analyze = () => {
    if (!tickers.length) return
    setLoading(true); setError('')
    fetch(`${API}/watchlist/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tickers }) })
      .then(r => r.json())
      .then(d => { setResult(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  const stocks = result?.stocks || result || []

  return (
    <>
      <div className="page-header">
        <h2>Sledovaný seznam</h2>
        <p>Sledujte vybrané akcie a analyzujte je najednou</p>
      </div>

      {stocks.length > 0 && (
        <div className="kpi-grid">
          <div className="kpi-card blue">
            <div className="kpi-header"><span className="kpi-label">Sledované akcie</span><span className="kpi-icon blue">👁</span></div>
            <div className="kpi-value">{stocks.length}</div>
            <div className="kpi-footer"><span className="kpi-sub">v sledovaném seznamu</span></div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-header"><span className="kpi-label">BUY signály</span><span className="kpi-icon green">✅</span></div>
            <div className="kpi-value">{stocks.filter(s => s.signal === 'BUY').length}</div>
            <div className="kpi-footer"><span className="kpi-sub">vhodné ke koupi</span></div>
          </div>
          <div className="kpi-card teal">
            <div className="kpi-header"><span className="kpi-label">Průměrné skóre</span><span className="kpi-icon teal">🎯</span></div>
            <div className="kpi-value">{(stocks.reduce((a, s) => a + (s.composite_score || 0), 0) / stocks.length).toFixed(1)}</div>
            <div className="kpi-footer"><span className="kpi-sub">kompozitní průměr</span></div>
          </div>
        </div>
      )}

      <div className="watchlist-input-area">
        <h3>📋 Spravovat seznam</h3>
        <div className="ticker-tags">
          {tickers.map(t => (
            <span key={t} className="ticker-tag">{t}<span className="remove-tag" onClick={() => setTickers(p => p.filter(x => x !== t))}>×</span></span>
          ))}
          {tickers.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Zatím žádné akcie...</span>}
        </div>
        <div className="watchlist-input-row">
          <input className="form-input" style={{ maxWidth: '200px' }} placeholder="Ticker (např. TSLA)" value={input}
            onChange={e => setInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addTicker()} />
          <button className="btn-secondary" onClick={addTicker} disabled={!input.trim()}>+ Přidat</button>
          <button className="btn-primary" onClick={analyze} disabled={loading || !tickers.length}>
            {loading ? '⏳ Analyzuji...' : '📊 Analyzovat'}
          </button>
        </div>
      </div>

      {error && <Chyba text={error} />}

      {stocks.length > 0 && (
        <div className="table-wrapper">
          <div className="table-header"><h3>📊 Výsledky analýzy</h3></div>
          <table>
            <thead><tr><th>Ticker</th><th>Název</th><th>Cena</th><th>Kompozit</th><th>Kvalita</th><th>Buy skóre</th><th>Přehřátí</th><th>Signál</th></tr></thead>
            <tbody>
              {stocks.map(s => (
                <tr key={s.ticker}>
                  <td><span className="ticker-cell">{s.ticker}</span></td>
                  <td><span className="company-cell">{s.company}</span></td>
                  <td><span className="price-cell">{fmtUSD(s.price)}</span></td>
                  <td><ScoreBar value={s.composite_score} /></td>
                  <td><ScoreBar value={s.quality_score} /></td>
                  <td><ScoreBar value={s.buy_score} /></td>
                  <td><ScoreBar value={s.overheat_score} inverted /></td>
                  <td><SignalBadge signal={s.signal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && stocks.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">👁</div>
          <p>Přidejte akcie do sledovaného seznamu a spusťte analýzu</p>
        </div>
      )}
    </>
  )
}

/* ─── PAGE 6: UPOZORNĚNÍ ────────────────────────── */
function Upozorneni() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('VSE')

  useEffect(() => {
    fetch(`${API}/alerts`)
      .then(r => r.json())
      .then(d => { setAlerts(Array.isArray(d) ? d : (d?.alerts || [])); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const typeLabels = { BUY_ZONE: 'Buy zóna', OVERHEATED: 'Přehřáté', HIGH_QUALITY: 'Vysoká kvalita', STRONG_COMPOSITE: 'Silné skóre', DCF_UPSIDE: 'DCF potenciál', DCF_OVERVALUED: 'Nadhodnocené' }
  const typeIcons = { BUY_ZONE: '🟢', OVERHEATED: '🔴', HIGH_QUALITY: '🟣', STRONG_COMPOSITE: '🔵', DCF_UPSIDE: '🟢', DCF_OVERVALUED: '🟠' }
  const allTypes = Object.keys(typeLabels)
  const counts = {}; allTypes.forEach(t => { counts[t] = alerts.filter(a => a.type === t).length })
  const filtered = filter === 'VSE' ? alerts : alerts.filter(a => a.type === filter)

  return (
    <>
      <div className="page-header">
        <h2>Upozornění</h2>
        <p>Automaticky generovaná upozornění na základě analýzy akcií</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-header"><span className="kpi-label">Celkem</span><span className="kpi-icon blue">🔔</span></div>
          <div className="kpi-value">{alerts.length}</div>
          <div className="kpi-footer"><span className="kpi-sub">aktivní upozornění</span></div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-header"><span className="kpi-label">Nákupní příleži.</span><span className="kpi-icon green">🟢</span></div>
          <div className="kpi-value">{(counts.BUY_ZONE || 0) + (counts.DCF_UPSIDE || 0)}</div>
          <div className="kpi-footer"><span className="kpi-sub">buy zóna + DCF</span></div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-header"><span className="kpi-label">Rizikové</span><span className="kpi-icon red">⚠️</span></div>
          <div className="kpi-value">{(counts.OVERHEATED || 0) + (counts.DCF_OVERVALUED || 0)}</div>
          <div className="kpi-footer"><span className="kpi-sub">přehřáté / nadhodnocené</span></div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-header"><span className="kpi-label">Vysoká kvalita</span><span className="kpi-icon purple">⭐</span></div>
          <div className="kpi-value">{counts.HIGH_QUALITY || 0}</div>
          <div className="kpi-footer"><span className="kpi-sub">fundamentálně silné</span></div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <h3>🔔 Upozornění</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className={`filter-btn ${filter === 'VSE' ? 'active' : ''}`} onClick={() => setFilter('VSE')}>Vše</button>
            {allTypes.map(t => (
              <button key={t} className={`filter-btn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>
                {typeIcons[t]} {typeLabels[t]}{counts[t] > 0 && <span style={{ marginLeft: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '0 5px', fontSize: '10px' }}>{counts[t]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px' }}>
          {error && <Chyba text={error} />}
          {loading ? <Nacitani text="Načítám upozornění..." /> : (
            filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div className="empty-icon">🔕</div>
                <p>Žádná upozornění pro vybraný filtr</p>
              </div>
            ) : (
              <div className="alerts-grid">
                {filtered.map((a, i) => (
                  <div key={i} className="alert-card">
                    <div className={`alert-icon ${a.type}`}>{typeIcons[a.type] || '🔵'}</div>
                    <div className="alert-body">
                      <div className="alert-ticker">{a.ticker}</div>
                      <div className="alert-message">{a.message}</div>
                    </div>
                    <span className={`alert-type-badge ${a.type}`}>{typeLabels[a.type] || a.type}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}

/* ─── PAGE 7: DCF KALKULAČKA ────────────────────── */
function DcfKalkulacka() {
  const [inputVal, setInputVal] = useState('')
  const [ticker, setTicker] = useState('')
  const [dcf, setDcf] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analyze = () => {
    const sym = inputVal.trim().toUpperCase()
    if (!sym) return
    setTicker(sym); setLoading(true); setError(''); setDcf(null)
    fetch(`${API}/stock/${sym}/dcf`)
      .then(r => r.json())
      .then(d => { setDcf(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  return (
    <>
      <div className="page-header">
        <h2>DCF Kalkulačka</h2>
        <p>Diskontovaný model peněžních toků pro ocenění akcie</p>
      </div>

      <div className="section-card" style={{ marginBottom: '20px' }}>
        <div className="section-header"><h3>📐 Vyhledat DCF analýzu</h3></div>
        <div style={{ padding: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input className="form-input" style={{ maxWidth: '280px' }} placeholder="Zadejte ticker (např. AAPL, MSFT)"
            value={inputVal} onChange={e => setInputVal(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && analyze()} />
          <button className="btn-primary" onClick={analyze} disabled={loading || !inputVal.trim()}>
            {loading ? '⏳ Počítám...' : '📐 Spustit DCF analýzu'}
          </button>
        </div>
      </div>

      {error && <Chyba text={error} />}
      {loading && <Nacitani text={`Počítám DCF model pro ${ticker}...`} />}

      {dcf && !loading && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card blue">
              <div className="kpi-header"><span className="kpi-label">Aktuální cena</span><span className="kpi-icon blue">💵</span></div>
              <div className="kpi-value" style={{ fontSize: '22px' }}>{fmtUSD(dcf.current_price)}</div>
              <div className="kpi-footer"><span className="kpi-sub">tržní cena</span></div>
            </div>
            <div className="kpi-card teal">
              <div className="kpi-header"><span className="kpi-label">Férová DCF hodnota</span><span className="kpi-icon teal">📐</span></div>
              <div className="kpi-value" style={{ fontSize: '22px', color: 'var(--teal)' }}>{fmtUSD(dcf.fair_value)}</div>
              <div className="kpi-footer"><span className="kpi-sub">dle DCF modelu</span></div>
            </div>
            <div className={`kpi-card ${(dcf.upside_pct || 0) >= 0 ? 'green' : 'red'}`}>
              <div className="kpi-header">
                <span className="kpi-label">Potenciál</span>
                <span className={`kpi-icon ${(dcf.upside_pct || 0) >= 0 ? 'green' : 'red'}`}>{(dcf.upside_pct || 0) >= 0 ? '📈' : '📉'}</span>
              </div>
              <div className="kpi-value">{(dcf.upside_pct || 0) >= 0 ? '+' : ''}{fmtPct(dcf.upside_pct)}</div>
              <div className="kpi-footer"><span className="kpi-sub">{(dcf.upside_pct || 0) >= 0 ? 'podhodnocená' : 'nadhodnocená'}</span></div>
            </div>
            <div className="kpi-card purple">
              <div className="kpi-header"><span className="kpi-label">DCF hodnocení</span><span className="kpi-icon purple">⭐</span></div>
              <div className="kpi-value" style={{ fontSize: '14px', paddingTop: '8px' }}>
                <span className={`rating-badge ${(dcf.rating || '').toLowerCase().replace(' ', '-')}`}>
                  {dcf.rating === 'STRONG BUY' ? 'SILNÝ NÁKUP' : dcf.rating === 'BUY' ? 'NÁKUP' : dcf.rating === 'HOLD' ? 'DRŽET' : dcf.rating || '–'}
                </span>
              </div>
              <div className="kpi-footer"><span className="kpi-sub">doporučení modelu</span></div>
            </div>
          </div>

          <div className="two-col">
            <div className="dcf-summary-card">
              <h3>Detaily DCF modelu – {ticker}</h3>
              <div className="dcf-values">
                {[
                  { label: 'Aktuální cena', val: fmtUSD(dcf.current_price) },
                  { label: 'Férová hodnota', val: fmtUSD(dcf.fair_value), color: 'var(--primary)' },
                  { label: 'Bezpečnostní marže', val: fmtUSD(dcf.margin_of_safety) },
                  { label: 'Potenciál růstu', val: `${(dcf.upside_pct || 0) >= 0 ? '+' : ''}${fmtPct(dcf.upside_pct)}`, color: (dcf.upside_pct || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Diskontní sazba', val: dcf.discount_rate ? fmtPct(dcf.discount_rate * 100) : '–' },
                  { label: 'Terminální růst', val: dcf.terminal_growth ? fmtPct(dcf.terminal_growth * 100) : '–' },
                ].map((row, i) => (
                  <div key={i} className="dcf-row">
                    <span className="dcf-row-label">{row.label}</span>
                    <span className="dcf-row-value" style={{ color: row.color || 'var(--text)' }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {dcf.projected_fcf?.length > 0 && (
              <div className="chart-card">
                <h3>Projekce volného cash flow</h3>
                <div className="bar-chart">
                  {(() => {
                    const maxV = Math.max(...dcf.projected_fcf.map(v => Math.abs(v)))
                    return dcf.projected_fcf.slice(0, 7).map((v, i) => (
                      <div key={i} className="bar-chart-bar" style={{ height: `${(Math.abs(v) / maxV) * 100}%`, background: v >= 0 ? 'var(--primary)' : 'var(--red)', opacity: 0.82 }}>
                        <span className="bar-value">{(v / 1e9).toFixed(1)}B</span>
                        <span className="bar-label">R{i + 1}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!dcf && !loading && !error && (
        <div className="empty-state">
          <div className="empty-icon">📐</div>
          <p>Zadejte ticker výše pro spuštění DCF analýzy</p>
          <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>DCF model diskontuje budoucí volné peněžní toky na současnou hodnotu</p>
        </div>
      )}
    </>
  )
}

/* ─── PAGE 8: AI ASISTENT ───────────────────────── */
function AiAsistent() {
  const [messages, setMessages] = useState([
    { type: 'ai', text: 'Dobrý den! Jsem váš AI investiční asistent. Mohu analyzovat konkrétní akcie, porovnávat společnosti nebo odpovídat na investiční dotazy. Zadejte ticker akcie nebo položte otázku.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { type: 'user', text }])
    setLoading(true)
    const ticker = text.match(/\b([A-Z]{2,5})\b/)?.[1]
    try {
      if (ticker) {
        const [sData, dcfData] = await Promise.all([
          fetch(`${API}/stock/${ticker}`).then(r => r.json()),
          fetch(`${API}/stock/${ticker}/dcf`).then(r => r.json()).catch(() => null)
        ])
        if (sData && !sData.detail) {
          let response = `**${sData.ticker} — ${sData.company || ''}**\n\n`
          response += `📊 Aktuální cena: ${fmtUSD(sData.price)}\n`
          response += `🎯 Signál: ${sData.signal === 'BUY' ? '▲ KOUPIT' : sData.signal === 'WATCH' ? '◆ SLEDOVAT' : '▼ VYHNOUT SE'}\n`
          response += `📈 Kompozitní skóre: ${fmt(sData.composite_score)}/100\n`
          response += `⭐ Skóre kvality: ${fmt(sData.quality_score)}/100\n`
          if (dcfData?.fair_value) response += `\n💡 DCF Férová hodnota: ${fmtUSD(dcfData.fair_value)} (${(dcfData.upside_pct || 0) >= 0 ? '+' : ''}${fmtPct(dcfData.upside_pct)} potenciál)\n`
          if (sData.ai_commentary) response += `\n🤖 AI hodnocení:\n${sData.ai_commentary}`
          setMessages(prev => [...prev, { type: 'ai', text: response }])
        } else {
          setMessages(prev => [...prev, { type: 'ai', text: `Ticker "${ticker}" nebyl nalezen. Zkuste: AAPL, MSFT, GOOGL, NVDA, TSLA.` }])
        }
      } else {
        const tips = [
          'Pro analýzu akcie zadejte její ticker symbol. Například: AAPL, MSFT, NVDA, TSLA nebo GOOGL.',
          'Mohu vám pomoci s analýzou konkrétní akcie (zadejte ticker), vysvětlením investičních metrik nebo hodnocením portfolia.',
          'Investiční tip: Kombinujte DCF analýzu pro ocenění s kompozitním skóre pro výběr kvality. Vyhledejte akcie s BUY signálem a DCF potenciálem >20%.',
        ]
        setMessages(prev => [...prev, { type: 'ai', text: tips[Math.floor(Math.random() * tips.length)] }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { type: 'ai', text: `Chyba při načítání dat: ${e.message}` }])
    }
    setLoading(false)
  }

  return (
    <>
      <div className="page-header">
        <h2>AI Asistent</h2>
        <p>Inteligentní poradenství pro vaše investiční rozhodnutí</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-header"><span className="kpi-label">AI engine</span><span className="kpi-icon blue">🤖</span></div>
          <div className="kpi-value" style={{ fontSize: '14px', paddingTop: '8px', fontWeight: 800 }}>GPT-4o</div>
          <div className="kpi-footer"><span className="kpi-sub">pokročilá analýza</span></div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-header"><span className="kpi-label">Rychlé akcie</span><span className="kpi-icon green">⚡</span></div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
            {['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA', 'AMZN'].map(t => (
              <button key={t} onClick={() => setInput(t)} style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid rgba(25,118,210,0.2)', borderRadius: '5px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{t}</button>
            ))}
          </div>
        </div>
        <div className="kpi-card teal">
          <div className="kpi-header"><span className="kpi-label">Zprávy</span><span className="kpi-icon teal">💬</span></div>
          <div className="kpi-value">{messages.length}</div>
          <div className="kpi-footer"><span className="kpi-sub">v konverzaci</span></div>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.type}`}>
              {msg.type === 'ai' && <div className="ai-badge">🤖 AI Asistent</div>}
              <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg ai">
              <div className="ai-badge">🤖 AI Asistent</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                <span style={{ color: 'var(--text-muted)' }}>Analyzuji...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-row">
          <input className="chat-input" placeholder="Zadejte ticker akcie nebo investiční dotaz... (Enter pro odeslání)"
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
          <button className="btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>Odeslat ➤</button>
        </div>
      </div>
    </>
  )
}

/* ─── PAGE 9: NASTAVENÍ ─────────────────────────── */
function Nastaveni() {
  return (
    <>
      <div className="page-header">
        <h2>Nastavení</h2>
        <p>Konfigurace aplikace a API připojení</p>
      </div>
      <div className="settings-section">
        <h3>🔌 API Připojení</h3>
        {[
          { label: 'API Endpoint', desc: 'Adresa backendu', val: API },
          { label: 'Stav připojení', desc: 'Aktivní spojení', val: '🟢 Připojeno' },
          { label: 'Verze API', desc: 'Aktuální verze', val: 'v1.0' },
        ].map((r, i) => (
          <div key={i} className="settings-row">
            <div><div className="settings-label">{r.label}</div><div className="settings-desc">{r.desc}</div></div>
            <span className="settings-val" style={{ fontSize: '12px', maxWidth: '300px', wordBreak: 'break-all', textAlign: 'right' }}>{r.val}</span>
          </div>
        ))}
      </div>
      <div className="settings-section">
        <h3>📊 Aktivní funkce</h3>
        {[
          { label: 'Denní sken', desc: 'Automatická analýza všech akcií' },
          { label: 'DCF model', desc: 'Diskontovaný model peněžních toků' },
          { label: 'AI komentáře', desc: 'Automatické AI hodnocení akcií' },
          { label: 'Upozornění', desc: 'Real-time investiční signály' },
          { label: 'Portfolio analýza', desc: 'P&L a diverzifikace portfolia' },
        ].map((r, i) => (
          <div key={i} className="settings-row">
            <div><div className="settings-label">{r.label}</div><div className="settings-desc">{r.desc}</div></div>
            <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '12px' }}>✓ Aktivní</span>
          </div>
        ))}
      </div>
      <div className="settings-section">
        <h3>🎨 O aplikaci</h3>
        {[
          { label: 'Název', val: 'AI Invest Dashboard' },
          { label: 'Verze', val: '2.0.0' },
          { label: 'Design', val: 'Trading212 / eToro style' },
          { label: 'Jazyk', val: 'Čeština' },
        ].map((r, i) => (
          <div key={i} className="settings-row">
            <div className="settings-label">{r.label}</div>
            <span className="settings-val">{r.val}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/* ─── MAIN APP ──────────────────────────────────── */
const PAGES = [
  { id: 'prehled',    label: 'Přehled',          icon: '🏠', section: 'HLAVNÍ' },
  { id: 'denniSken',  label: 'Denní sken',        icon: '📡', section: 'HLAVNÍ' },
  { id: 'analyza',    label: 'Analýza akcie',     icon: '🔍', section: 'NÁSTROJE' },
  { id: 'portfolio',  label: 'Portfolio',         icon: '💼', section: 'NÁSTROJE' },
  { id: 'watchlist',  label: 'Sledovaný seznam',  icon: '👁',  section: 'NÁSTROJE' },
  { id: 'upozorneni', label: 'Upozornění',        icon: '🔔', section: 'SIGNÁLY' },
  { id: 'dcf',        label: 'DCF kalkulačka',    icon: '📐', section: 'SIGNÁLY' },
  { id: 'asistent',   label: 'AI asistent',       icon: '🤖', section: 'SIGNÁLY' },
  { id: 'nastaveni',  label: 'Nastavení',         icon: '⚙️', section: 'SYSTÉM' },
]

const PAGE_TITLES = {
  prehled: 'Přehled trhu', denniSken: 'Denní sken akcií', analyza: 'Analýza akcie',
  portfolio: 'Správa portfolia', watchlist: 'Sledovaný seznam', upozorneni: 'Upozornění',
  dcf: 'DCF kalkulačka', asistent: 'AI asistent', nastaveni: 'Nastavení'
}

export default function App() {
  const [page, setPage] = useState('prehled')
  const [selectedTicker, setSelectedTicker] = useState(null)

  const sections = [...new Set(PAGES.map(p => p.section))]

  return (
    <div id="root">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">📈</div>
          <div className="logo-text">
            <div className="logo-mark">Invest AI</div>
            <h1>Smart<span>Trade</span></h1>
          </div>
        </div>

        <div className="nav-items">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {PAGES.filter(p => p.section === section).map(p => (
                <div key={p.id} className={`nav-item ${page === p.id ? 'active' : ''}`} onClick={() => setPage(p.id)}>
                  <span className="nav-icon">{p.icon}</span>
                  {p.label}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="status-dot">
            <div className="dot" />
            API aktivní · Live data
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{PAGE_TITLES[page]}</div>
            <div className="topbar-subtitle">{dnesniDatum()}</div>
          </div>
          <div className="topbar-right">
            <span className="topbar-badge">🔴 Live</span>
            <span className="topbar-date">SmartTrade v2.0</span>
          </div>
        </header>

        <div className="page-content">
          {page === 'prehled'    && <Prehled onSelectStock={setSelectedTicker} onNavigate={setPage} />}
          {page === 'denniSken'  && <DenniSken onSelectStock={setSelectedTicker} onNavigate={setPage} />}
          {page === 'analyza'    && <AnalyzaAkcii preselectedTicker={selectedTicker} onClear={() => setSelectedTicker(null)} />}
          {page === 'portfolio'  && <Portfolio />}
          {page === 'watchlist'  && <SledovanySenam />}
          {page === 'upozorneni' && <Upozorneni />}
          {page === 'dcf'        && <DcfKalkulacka />}
          {page === 'asistent'   && <AiAsistent />}
          {page === 'nastaveni'  && <Nastaveni />}
        </div>
      </main>
    </div>
  )
}
