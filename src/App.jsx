import { useState, useEffect } from 'react'

const API = 'https://ai-invest-agent-production.up.railway.app'

// ============================================================
// UTILITY
// ============================================================
function fmt(val, decimals = 2) {
  if (val === null || val === undefined || val === '') return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return n.toFixed(decimals)
}
function fmtPct(val, decimals = 1) {
  if (val === null || val === undefined || val === '') return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return (n * 100).toFixed(decimals) + ' %'
}
function fmtNum(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
}
function signalColor(signal) {
  const s = String(signal).toUpperCase()
  if (s === 'BUY') return '#10B981'
  if (s === 'SELL') return '#EF4444'
  return '#F59E0B'
}
function scoreColor(score) {
  const n = parseFloat(score)
  if (isNaN(n)) return '#64748B'
  if (n >= 22) return '#10B981'
  if (n >= 16) return '#2563EB'
  if (n >= 10) return '#F59E0B'
  return '#EF4444'
}

// ============================================================
// METRIC DEFINITIONS (popup info)
// ============================================================
const METRIC_INFO = {
  composite_score: {
    name: 'Composite Score',
    desc: 'Celkové skóre kombinující kvalitu firmy, nákupní signály a stupeň přehřátí. Vyšší = lepší investiční příležitost.',
    ranges: [
      { label: 'Slabé', range: '0–12', color: '#EF4444' },
      { label: 'Průměrné', range: '12–18', color: '#F59E0B' },
      { label: 'Dobré', range: '18–22', color: '#2563EB' },
      { label: 'Výborné', range: '22+', color: '#10B981' },
    ],
  },
  quality_score: {
    name: 'Quality Score',
    desc: 'Hodnotí fundamentální kvalitu firmy: ROIC, marže, růst, zadlužení a konzistenci výsledků.',
    ranges: [
      { label: 'Nízká kvalita', range: '0–4', color: '#EF4444' },
      { label: 'Průměrná', range: '4–7', color: '#F59E0B' },
      { label: 'Vysoká', range: '7–10', color: '#2563EB' },
      { label: 'Výjimečná', range: '10–12', color: '#10B981' },
    ],
  },
  overheat_score: {
    name: 'Overheat Score',
    desc: 'Signalizuje přehřátí akcie. Zohledňuje momentum, technická přeprodání a valuační extrémy. Nižší = bezpečnější vstup.',
    ranges: [
      { label: 'Chladná', range: '0–1', color: '#10B981' },
      { label: 'Normální', range: '1–3', color: '#2563EB' },
      { label: 'Lehce přehřátá', range: '3–4', color: '#F59E0B' },
      { label: 'Přehřátá', range: '4+', color: '#EF4444' },
    ],
  },
  roic: {
    name: 'ROIC – Návratnost kapitálu',
    desc: 'Return on Invested Capital – návratnost investovaného kapitálu. Jeden z nejdůležitějších ukazatelů kvality podnikání.',
    ranges: [
      { label: 'Slabé', range: '< 5 %', color: '#EF4444' },
      { label: 'Průměrné', range: '5–15 %', color: '#F59E0B' },
      { label: 'Dobré', range: '15–25 %', color: '#2563EB' },
      { label: 'Výborné', range: '25 %+', color: '#10B981' },
    ],
  },
  gross_margin: {
    name: 'Hrubá marže',
    desc: 'Podíl hrubého zisku na tržbách. Odráží cenovou sílu a konkurenční výhodu firmy.',
    ranges: [
      { label: 'Nízká', range: '< 30 %', color: '#EF4444' },
      { label: 'Průměrná', range: '30–50 %', color: '#F59E0B' },
      { label: 'Dobrá', range: '50–70 %', color: '#2563EB' },
      { label: 'Výborná', range: '70 %+', color: '#10B981' },
    ],
  },
  fcf_margin: {
    name: 'FCF marže – Volný peněžní tok',
    desc: 'Free Cash Flow jako % tržeb. Odráží skutečnou schopnost firmy generovat hotovost po investicích.',
    ranges: [
      { label: 'Záporná', range: '< 0 %', color: '#EF4444' },
      { label: 'Nízká', range: '0–10 %', color: '#F59E0B' },
      { label: 'Dobrá', range: '10–20 %', color: '#2563EB' },
      { label: 'Výborná', range: '20 %+', color: '#10B981' },
    ],
  },
  revenue_growth: {
    name: 'Růst tržeb (YoY)',
    desc: 'Meziroční procentní růst tržeb. Klíčový ukazatel dynamiky a zdraví podnikání.',
    ranges: [
      { label: 'Záporný', range: '< 0 %', color: '#EF4444' },
      { label: 'Pomalý', range: '0–5 %', color: '#F59E0B' },
      { label: 'Dobrý', range: '5–20 %', color: '#2563EB' },
      { label: 'Silný', range: '20 %+', color: '#10B981' },
    ],
  },
  ev_to_sales: {
    name: 'EV/Sales (Enterprise Value / Tržby)',
    desc: 'Porovnává tržní hodnotu firmy s jejími tržbami. Vhodné pro srovnání napříč sektory.',
    ranges: [
      { label: 'Levné', range: '< 2×', color: '#10B981' },
      { label: 'Přiměřené', range: '2–5×', color: '#2563EB' },
      { label: 'Drahé', range: '5–10×', color: '#F59E0B' },
      { label: 'Velmi drahé', range: '10×+', color: '#EF4444' },
    ],
  },
  ev_to_fcf: {
    name: 'EV/FCF (Enterprise Value / FCF)',
    desc: 'Klíčový valuační ukazatel – kolik zaplatíte za $1 volného peněžního toku.',
    ranges: [
      { label: 'Podhodnocené', range: '< 15×', color: '#10B981' },
      { label: 'Přiměřené', range: '15–25×', color: '#2563EB' },
      { label: 'Drahé', range: '25–40×', color: '#F59E0B' },
      { label: 'Velmi drahé', range: '40×+', color: '#EF4444' },
    ],
  },
  upside_percent: {
    name: 'DCF Upside / potenciál růstu',
    desc: 'Odhadovaný procentní potenciál růstu dle DCF modelu ve srovnání s aktuální tržní cenou.',
    ranges: [
      { label: 'Nadhodnocené', range: '< −10 %', color: '#EF4444' },
      { label: 'Férová cena', range: '−10 – 10 %', color: '#F59E0B' },
      { label: 'Nákupní příležitost', range: '10–25 %', color: '#2563EB' },
      { label: 'Silně podhodnocené', range: '25 %+', color: '#10B981' },
    ],
  },
  current_ratio: {
    name: 'Current Ratio (běžná likvidita)',
    desc: 'Oběžná aktiva / krátkodobé závazky. Měří schopnost firmy pokrýt krátkodobé závazky.',
    ranges: [
      { label: 'Rizikové', range: '< 0.8×', color: '#EF4444' },
      { label: 'Přiměřené', range: '0.8–1.5×', color: '#F59E0B' },
      { label: 'Dobré', range: '1.5–2.5×', color: '#2563EB' },
      { label: 'Silné', range: '2.5×+', color: '#10B981' },
    ],
  },
  net_debt_to_ebitda: {
    name: 'Čistý dluh / EBITDA',
    desc: 'Míra zadluženosti. Záporná hodnota = firma drží více hotovosti než dluhu (net cash pozice).',
    ranges: [
      { label: 'Net cash', range: '< 0×', color: '#10B981' },
      { label: 'Nízký dluh', range: '0–1.5×', color: '#2563EB' },
      { label: 'Střední dluh', range: '1.5–3×', color: '#F59E0B' },
      { label: 'Vysoký dluh', range: '3×+', color: '#EF4444' },
    ],
  },
}

// ============================================================
// INFO POPUP
// ============================================================
function InfoPopup({ metric, value, onClose }) {
  const info = METRIC_INFO[metric]
  if (!info) return null
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={e => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose}>×</button>
        <h3 className="popup-title">{info.name}</h3>
        <p className="popup-desc">{info.desc}</p>
        {value !== undefined && (
          <div className="popup-value">Aktuální hodnota: <strong>{value}</strong></div>
        )}
        <div className="popup-ranges">
          <p className="popup-ranges-title">Hodnocení:</p>
          {info.ranges.map(r => (
            <div key={r.label} className="popup-range-row">
              <span className="popup-range-dot" style={{ background: r.color }} />
              <span className="popup-range-label">{r.label}</span>
              <span className="popup-range-val">{r.range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// KPI CARD
// ============================================================
function KpiCard({ label, value, metric, sub, color, icon }) {
  const [showPopup, setShowPopup] = useState(false)
  const hasInfo = metric && METRIC_INFO[metric]
  return (
    <>
      <div
        className={`kpi-card${hasInfo ? ' kpi-card--clickable' : ''}`}
        onClick={() => hasInfo && setShowPopup(true)}
      >
        <div className="kpi-header">
          <span className="kpi-label">{label}</span>
          {icon && <span className="kpi-icon">{icon}</span>}
        </div>
        <div className="kpi-value" style={{ color: color || '#1E293B' }}>{value}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
        {hasInfo && <div className="kpi-hint">klikni pro detail →</div>}
      </div>
      {showPopup && <InfoPopup metric={metric} value={value} onClose={() => setShowPopup(false)} />}
    </>
  )
}

// ============================================================
// METRIC ROW (detail page)
// ============================================================
function MetricRow({ label, value, metric }) {
  const [show, setShow] = useState(false)
  const hasInfo = metric && METRIC_INFO[metric]
  return (
    <>
      <div
        className={`metric-row${hasInfo ? ' metric-row--click' : ''}`}
        onClick={() => hasInfo && setShow(true)}
      >
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
        {hasInfo && <span className="metric-info-icon">ℹ</span>}
      </div>
      {show && <InfoPopup metric={metric} value={value} onClose={() => setShow(false)} />}
    </>
  )
}

// ============================================================
// SVG CHARTS
// ============================================================
function SvgLineChart({ data, labels, color = '#2563EB', title }) {
  if (!data || data.length < 2) return <div className="chart-empty">Nedostatek dat</div>
  const W = 400, H = 160
  const pad = { t: 20, r: 20, b: 30, l: 46 }
  const cW = W - pad.l - pad.r
  const cH = H - pad.t - pad.b
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: pad.l + (i / (data.length - 1)) * cW,
    y: pad.t + (1 - (v - min) / range) * cH,
  }))
  const line = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`
    const pr = pts[i - 1]
    return acc + ` C${pr.x + (p.x - pr.x) / 2},${pr.y} ${pr.x + (p.x - pr.x) / 2},${p.y} ${p.x},${p.y}`
  }, '')
  const area = line + ` L${pts[pts.length - 1].x},${pad.t + cH} L${pad.l},${pad.t + cH}Z`
  return (
    <div className="svg-chart">
      {title && <div className="chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {[0, .25, .5, .75, 1].map(t => (
          <line key={t} x1={pad.l} y1={pad.t + t * cH} x2={pad.l + cW} y2={pad.t + t * cH} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {[0, .5, 1].map(t => (
          <text key={t} x={pad.l - 5} y={pad.t + (1 - t) * cH + 4} textAnchor="end" fontSize="9" fill="#94A3B8">
            {(min + t * range).toFixed(1)}
          </text>
        ))}
        <path d={area} fill={color} fillOpacity=".1" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />)}
        {labels && labels.map((l, i) => (
          <text key={i} x={pad.l + (i / (labels.length - 1)) * cW} y={H - 5} textAnchor="middle" fontSize="9" fill="#94A3B8">{l}</text>
        ))}
      </svg>
    </div>
  )
}

function SvgBarChart({ data, labels, color = '#2563EB', title, formatFn }) {
  if (!data || data.length === 0) return null
  const W = 400, H = 160
  const pad = { t: 24, r: 16, b: 30, l: 46 }
  const cW = W - pad.l - pad.r
  const cH = H - pad.t - pad.b
  const maxAbs = Math.max(...data.map(Math.abs), 1)
  const slot = cW / data.length
  const bW = Math.max(slot * 0.55, 6)
  return (
    <div className="svg-chart">
      {title && <div className="chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {[0, .5, 1].map(t => (
          <line key={t} x1={pad.l} y1={pad.t + t * cH} x2={pad.l + cW} y2={pad.t + t * cH} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {[0, .5, 1].map(t => (
          <text key={t} x={pad.l - 5} y={pad.t + (1 - t) * cH + 4} textAnchor="end" fontSize="9" fill="#94A3B8">
            {(t * maxAbs).toFixed(0)}
          </text>
        ))}
        {data.map((v, i) => {
          const bH = (Math.abs(v) / maxAbs) * cH
          const x = pad.l + i * slot + (slot - bW) / 2
          const c = v >= 0 ? color : '#EF4444'
          return (
            <g key={i}>
              <rect x={x} y={pad.t + cH - bH} width={bW} height={Math.max(bH, 1)} fill={c} rx="3" />
              <text x={x + bW / 2} y={pad.t + cH - bH - 4} textAnchor="middle" fontSize="8" fill={c}>
                {formatFn ? formatFn(v) : v.toFixed(1)}
              </text>
            </g>
          )
        })}
        {labels && labels.map((l, i) => (
          <text key={i} x={pad.l + i * slot + slot / 2} y={H - 5} textAnchor="middle" fontSize="9" fill="#94A3B8">{l}</text>
        ))}
      </svg>
    </div>
  )
}

function SvgDonutChart({ data, colors, labels, title }) {
  if (!data || data.length === 0) return null
  const cx = 90, cy = 90, r = 68, ir = 42
  const total = data.reduce((a, b) => a + b, 0)
  let angle = -Math.PI / 2
  const slices = data.map((v, i) => {
    const a = (v / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(angle + a), y2 = cy + r * Math.sin(angle + a)
    const ix1 = cx + ir * Math.cos(angle), iy1 = cy + ir * Math.sin(angle)
    const ix2 = cx + ir * Math.cos(angle + a), iy2 = cy + ir * Math.sin(angle + a)
    const lg = a > Math.PI ? 1 : 0
    const d = `M${x1},${y1} A${r},${r} 0 ${lg} 1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${lg} 0 ${ix1},${iy1}Z`
    const s = { d, color: colors[i % colors.length], label: labels?.[i], pct: (v / total * 100).toFixed(1) }
    angle += a
    return s
  })
  return (
    <div className="svg-chart">
      {title && <div className="chart-title">{title}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <svg viewBox="0 0 180 180" width="160" style={{ flexShrink: 0 }}>
          {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="2" />)}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="#94A3B8">Portfolio</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1E293B">Sektory</text>
        </svg>
        <div className="donut-legend">
          {slices.map((s, i) => (
            <div key={i} className="donut-legend-item">
              <span className="donut-dot" style={{ background: s.color }} />
              <span className="donut-legend-label">{s.label}</span>
              <span className="donut-legend-pct">{s.pct} %</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ value, max, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ============================================================
// LOADING / ERROR
// ============================================================
function Loading() { return <div className="loading"><div className="spinner" /></div> }
function ErrorMsg({ msg }) { return <div className="error-msg">⚠ {msg}</div> }

// ============================================================
// PAGE: DASHBOARD
// ============================================================
function DashboardPage() {
  const [scan, setScan] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/daily-scan`).then(r => r.json()),
      fetch(`${API}/alerts`).then(r => r.json()),
    ])
      .then(([s, a]) => { setScan(s); setAlerts(a) })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (err) return <ErrorMsg msg={err} />

  const buyCount = scan?.top?.filter(s => String(s.signal).toUpperCase() === 'BUY').length ?? 0
  const avgScore = scan?.top?.length
    ? (scan.top.reduce((s, x) => s + parseFloat(x.composite_score || 0), 0) / scan.top.length).toFixed(1)
    : '—'

  return (
    <div className="page">
      <h1 className="page-title">Přehled trhu</h1>
      <div className="kpi-row">
        <KpiCard label="Sledovaných akcií" value={scan?.count ?? 0} icon="📊" />
        <KpiCard label="BUY signály" value={buyCount} color="#10B981" icon="📈" />
        <KpiCard label="Prům. Composite Score" value={avgScore} metric="composite_score" icon="⭐" />
        <KpiCard label="Aktivní alerty" value={alerts?.count ?? 0} color="#F59E0B" icon="🔔" />
      </div>

      <div className="section">
        <h2 className="section-title">Top akcie – seřazeno dle Composite Score</h2>
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Společnost</th>
                  <th>Sektor</th>
                  <th>Cena</th>
                  <th>Signál</th>
                  <th>Composite ▼</th>
                  <th>Quality</th>
                  <th>Overheat</th>
                  <th>FCF marže</th>
                  <th>Růst tržeb</th>
                </tr>
              </thead>
              <tbody>
                {scan?.top?.map(s => (
                  <tr key={s.ticker}>
                    <td><span className="ticker-badge">{s.ticker}</span></td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.company}</td>
                    <td><span className="sector-tag">{s.sector}</span></td>
                    <td className="num">${fmt(s.price)}</td>
                    <td>
                      <span className="signal-badge" style={{ background: signalColor(s.signal) }}>{s.signal}</span>
                    </td>
                    <td className="num" style={{ color: scoreColor(s.composite_score), fontWeight: 700 }}>
                      {fmt(s.composite_score, 1)}
                    </td>
                    <td className="num">{fmt(s.quality_score, 0)}</td>
                    <td className="num">{fmt(s.overheat_score, 0)}</td>
                    <td className="num">{fmtPct(s.fcf_margin)}</td>
                    <td className="num">{fmtPct(s.revenue_growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Aktivní alerty</h2>
        <div className="alerts-grid">
          {alerts?.alerts?.slice(0, 12).map((a, i) => (
            <div key={i} className={`alert-card alert-${a.type.toLowerCase()}`}>
              <div className="alert-header">
                <span className="alert-ticker">{a.ticker}</span>
                <span className="alert-type">{a.type.replace(/_/g, ' ')}</span>
              </div>
              <div className="alert-company">{a.company}</div>
              <div className="alert-msg">{a.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PAGE: SCANNER
// ============================================================
function ScannerPage() {
  const [scan, setScan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [filterSignal, setFilterSignal] = useState('ALL')
  const [filterSector, setFilterSector] = useState('ALL')
  const [minScore, setMinScore] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`${API}/daily-scan`)
      .then(r => r.json())
      .then(setScan)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (err) return <ErrorMsg msg={err} />

  const sectors = ['ALL', ...new Set(scan?.top?.map(s => s.sector).filter(Boolean))]
  const filtered = (scan?.top ?? []).filter(s => {
    if (filterSignal !== 'ALL' && String(s.signal).toUpperCase() !== filterSignal) return false
    if (filterSector !== 'ALL' && s.sector !== filterSector) return false
    if (parseFloat(s.composite_score) < minScore) return false
    if (search && !`${s.ticker} ${s.company}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const buyCount = filtered.filter(s => String(s.signal).toUpperCase() === 'BUY').length
  const avgScore = filtered.length
    ? (filtered.reduce((s, x) => s + parseFloat(x.composite_score || 0), 0) / filtered.length).toFixed(1)
    : '—'

  return (
    <div className="page">
      <h1 className="page-title">Skener signálů</h1>
      <div className="kpi-row">
        <KpiCard label="Výsledky" value={filtered.length} icon="📋" />
        <KpiCard label="BUY signály" value={buyCount} color="#10B981" icon="📈" />
        <KpiCard label="Prům. Composite" value={avgScore} metric="composite_score" icon="⭐" />
      </div>

      <div className="filter-bar">
        <span className="filter-label">Filtr:</span>
        <input
          className="search-input"
          style={{ maxWidth: 160 }}
          placeholder="Hledat ticker…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={filterSignal} onChange={e => setFilterSignal(e.target.value)}>
          <option value="ALL">Všechny signály</option>
          <option value="BUY">BUY</option>
          <option value="HOLD">HOLD</option>
          <option value="SELL">SELL</option>
        </select>
        <select className="filter-select" value={filterSector} onChange={e => setFilterSector(e.target.value)}>
          {sectors.map(s => <option key={s} value={s}>{s === 'ALL' ? 'Všechny sektory' : s}</option>)}
        </select>
        <select className="filter-select" value={minScore} onChange={e => setMinScore(Number(e.target.value))}>
          <option value={0}>Min. Composite: libovolné</option>
          <option value={10}>Min. Composite: 10+</option>
          <option value={15}>Min. Composite: 15+</option>
          <option value={20}>Min. Composite: 20+</option>
          <option value={22}>Min. Composite: 22+</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Společnost</th>
                <th>Sektor</th>
                <th>Cena</th>
                <th>Signál</th>
                <th>Composite</th>
                <th>Quality</th>
                <th>Overheat</th>
                <th>ROIC</th>
                <th>Hrubá marže</th>
                <th>FCF marže</th>
                <th>EV/FCF</th>
                <th>Změna 1Y</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.ticker}>
                  <td><span className="ticker-badge">{s.ticker}</span></td>
                  <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.company}</td>
                  <td><span className="sector-tag">{s.sector}</span></td>
                  <td className="num">${fmt(s.price)}</td>
                  <td>
                    <span className="signal-badge" style={{ background: signalColor(s.signal) }}>{s.signal}</span>
                  </td>
                  <td className="num" style={{ color: scoreColor(s.composite_score), fontWeight: 700 }}>{fmt(s.composite_score, 1)}</td>
                  <td className="num">{fmt(s.quality_score, 0)}</td>
                  <td className="num">{fmt(s.overheat_score, 0)}</td>
                  <td className="num">{fmtPct(s.roic)}</td>
                  <td className="num">{fmtPct(s.gross_margin)}</td>
                  <td className="num">{fmtPct(s.fcf_margin)}</td>
                  <td className="num">{fmt(s.ev_to_fcf, 1)}×</td>
                  <td className="num" style={{ color: parseFloat(s.change_1y) >= 0 ? '#10B981' : '#EF4444' }}>
                    {parseFloat(s.change_1y) >= 0 ? '+' : ''}{fmt(s.change_1y, 1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PAGE: STOCK DETAIL
// ============================================================
function StockDetailPage() {
  const [inputVal, setInputVal] = useState('')
  const [stock, setStock] = useState(null)
  const [dcf, setDcf] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const load = async (t) => {
    const sym = t.trim().toUpperCase()
    if (!sym) return
    setLoading(true); setErr(null); setStock(null); setDcf(null)
    try {
      const [sd, dd] = await Promise.all([
        fetch(`${API}/stock/${sym}`).then(r => { if (!r.ok) throw new Error(`${sym} nenalezen v databázi`); return r.json() }),
        fetch(`${API}/stock/${sym}/dcf`).then(r => r.ok ? r.json() : null),
      ])
      setStock(sd); setDcf(dd)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <h1 className="page-title">Detail akcie</h1>
      <div className="search-bar">
        <input className="search-input" placeholder="Zadej ticker (např. NVDA, AAPL, MSFT)…"
          value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(inputVal)} />
        <button className="btn-primary" onClick={() => load(inputVal)}>Hledat</button>
      </div>
      {loading && <Loading />}
      {err && <ErrorMsg msg={err} />}
      {stock && (
        <>
          <div className="stock-header">
            <h2>{stock.company}</h2>
            <span className="ticker-badge">{stock.ticker}</span>
            <span className="sector-tag">{stock.sector}</span>
          </div>
          <div className="kpi-row">
            <KpiCard label="Cena" value={`$${fmt(stock.price)}`} icon="💵" />
            <KpiCard label="Signál" value={stock.signal} color={signalColor(stock.signal)} icon="📡" />
            <KpiCard label="Composite Score" value={fmt(stock.composite_score, 1)} metric="composite_score" color={scoreColor(stock.composite_score)} />
            <KpiCard label="Quality Score" value={fmt(stock.quality_score, 0)} metric="quality_score" color="#2563EB" />
            <KpiCard label="Overheat Score" value={fmt(stock.overheat_score, 0)} metric="overheat_score" />
            {dcf && (
              <KpiCard
                label="DCF Upside"
                value={`${dcf.upside_percent >= 0 ? '+' : ''}${fmt(dcf.upside_percent, 1)} %`}
                metric="upside_percent"
                color={dcf.upside_percent >= 10 ? '#10B981' : dcf.upside_percent >= -10 ? '#F59E0B' : '#EF4444'}
              />
            )}
          </div>
          <div className="detail-grid">
            <div className="card">
              <h3 className="card-title">Profitabilita</h3>
              <MetricRow label="ROIC" value={fmtPct(stock.roic)} metric="roic" />
              <MetricRow label="Hrubá marže" value={fmtPct(stock.gross_margin)} metric="gross_margin" />
              <MetricRow label="FCF marže" value={fmtPct(stock.fcf_margin)} metric="fcf_margin" />
              <MetricRow label="Růst tržeb (YoY)" value={fmtPct(stock.revenue_growth)} metric="revenue_growth" />
              <MetricRow label="Růst EPS (YoY)" value={fmtPct(stock.eps_growth)} />
            </div>
            <div className="card">
              <h3 className="card-title">Valuace</h3>
              <MetricRow label="EV / Sales" value={`${fmt(stock.ev_to_sales, 2)}×`} metric="ev_to_sales" />
              <MetricRow label="EV / FCF" value={`${fmt(stock.ev_to_fcf, 1)}×`} metric="ev_to_fcf" />
              <MetricRow label="Čistý dluh / EBITDA" value={`${fmt(stock.net_debt_to_ebitda, 2)}×`} metric="net_debt_to_ebitda" />
              <MetricRow label="Current Ratio" value={`${fmt(stock.current_ratio, 2)}×`} metric="current_ratio" />
            </div>
            <div className="card">
              <h3 className="card-title">Výkonnost &amp; Skóre</h3>
              <MetricRow label="Změna 6M" value={`${parseFloat(stock.change_6m) >= 0 ? '+' : ''}${fmt(stock.change_6m, 1)} %`} />
              <MetricRow label="Změna 1Y" value={`${parseFloat(stock.change_1y) >= 0 ? '+' : ''}${fmt(stock.change_1y, 1)} %`} />
              <MetricRow label="Buy Score" value={fmt(stock.buy_score, 0)} />
            </div>
            {dcf && (
              <div className="card">
                <h3 className="card-title">DCF Ocenění</h3>
                <MetricRow label="Aktuální cena" value={`$${fmt(dcf.current_price)}`} />
                <MetricRow label="Férová hodnota (DCF)" value={`$${fmt(dcf.estimated_fair_value)}`} />
                <MetricRow label="Potenciál" value={`${dcf.upside_percent >= 0 ? '+' : ''}${fmt(dcf.upside_percent, 1)} %`} metric="upside_percent" />
                <MetricRow label="Rating" value={dcf.rating} />
                <div className="dcf-visual" style={{ marginTop: 12 }}>
                  <div className="dcf-bar-wrap">
                    <div className="dcf-bar-label">Aktuální cena</div>
                    <div className="dcf-bar-track">
                      <div className="dcf-bar-fill dcf-bar--price"
                        style={{ width: `${Math.min(100, (dcf.current_price / Math.max(dcf.current_price, dcf.estimated_fair_value) * 100))}%` }} />
                    </div>
                    <div className="dcf-bar-val">${fmt(dcf.current_price)}</div>
                  </div>
                  <div className="dcf-bar-wrap">
                    <div className="dcf-bar-label">Férová hodnota</div>
                    <div className="dcf-bar-track">
                      <div className="dcf-bar-fill dcf-bar--fair"
                        style={{ width: `${Math.min(100, (dcf.estimated_fair_value / Math.max(dcf.current_price, dcf.estimated_fair_value) * 100))}%` }} />
                    </div>
                    <div className="dcf-bar-val">${fmt(dcf.estimated_fair_value)}</div>
                  </div>
                </div>
                <div className={`dcf-rating dcf-rating--${dcf.rating === 'Strong Buy' || dcf.rating === 'Buy' ? 'buy' : dcf.rating === 'Hold' ? 'hold' : 'sell'}`}>
                  {dcf.rating}
                </div>
                <div className="ai-comment">{dcf.ai_comment}</div>
              </div>
            )}
          </div>
          {dcf?.projected_fcf_per_share && (
            <div className="card mt-20">
              <h3 className="card-title">Projekce FCF na akcii – 5letý výhled (DCF model)</h3>
              <SvgBarChart
                data={dcf.projected_fcf_per_share}
                labels={['Rok 1', 'Rok 2', 'Rok 3', 'Rok 4', 'Rok 5']}
                color="#2563EB"
                formatFn={v => `$${v.toFixed(1)}`}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// PAGE: DEEP VALUATION
// ============================================================
function DeepValuationPage() {
  const [inputVal, setInputVal] = useState('')
  const [stock, setStock] = useState(null)
  const [dcf, setDcf] = useState(null)
  const [peers, setPeers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const load = async (t) => {
    const sym = t.trim().toUpperCase()
    if (!sym) return
    setLoading(true); setErr(null)
    try {
      const [sd, dd, scan] = await Promise.all([
        fetch(`${API}/stock/${sym}`).then(r => { if (!r.ok) throw new Error(`${sym} nenalezen`); return r.json() }),
        fetch(`${API}/stock/${sym}/dcf`).then(r => r.ok ? r.json() : null),
        fetch(`${API}/daily-scan`).then(r => r.json()),
      ])
      setStock(sd); setDcf(dd)
      setPeers((scan?.top ?? []).filter(s => s.sector === sd.sector && s.ticker !== sd.ticker).slice(0, 5))
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const ValBox = ({ label, value, metric }) => {
    const [show, setShow] = useState(false)
    return (
      <>
        <div
          className={`valuation-metric${metric && METRIC_INFO[metric] ? ' valuation-metric--click' : ''}`}
          onClick={() => metric && METRIC_INFO[metric] && setShow(true)}
        >
          <div className="val-metric-label">{label}</div>
          <div className="val-metric-value">{value}</div>
          {metric && METRIC_INFO[metric] && <div className="val-metric-hint">klikni pro detail →</div>}
        </div>
        {show && <InfoPopup metric={metric} value={value} onClose={() => setShow(false)} />}
      </>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">Deep Valuation</h1>
      <div className="search-bar">
        <input className="search-input" placeholder="Zadej ticker…"
          value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(inputVal)} />
        <button className="btn-primary" onClick={() => load(inputVal)}>Analyzovat</button>
      </div>
      {loading && <Loading />}
      {err && <ErrorMsg msg={err} />}
      {stock && (
        <>
          <div className="stock-header">
            <h2>{stock.company}</h2>
            <span className="ticker-badge">{stock.ticker}</span>
            <span className="sector-tag">{stock.sector}</span>
          </div>
          <div className="kpi-row">
            <KpiCard label="EV / Sales" value={`${fmt(stock.ev_to_sales, 2)}×`} metric="ev_to_sales"
              color={parseFloat(stock.ev_to_sales) < 5 ? '#10B981' : parseFloat(stock.ev_to_sales) < 10 ? '#F59E0B' : '#EF4444'} />
            <KpiCard label="EV / FCF" value={`${fmt(stock.ev_to_fcf, 1)}×`} metric="ev_to_fcf"
              color={parseFloat(stock.ev_to_fcf) < 25 ? '#10B981' : parseFloat(stock.ev_to_fcf) < 40 ? '#F59E0B' : '#EF4444'} />
            {dcf && (
              <KpiCard label="DCF Férová hodnota" value={`$${fmt(dcf.estimated_fair_value)}`} metric="upside_percent"
                sub={`Upside: ${dcf.upside_percent >= 0 ? '+' : ''}${fmt(dcf.upside_percent, 1)} %`}
                color={dcf.upside_percent >= 10 ? '#10B981' : dcf.upside_percent >= -10 ? '#F59E0B' : '#EF4444'} />
            )}
            <KpiCard label="Čistý dluh / EBITDA" value={`${fmt(stock.net_debt_to_ebitda, 2)}×`} metric="net_debt_to_ebitda"
              color={parseFloat(stock.net_debt_to_ebitda) < 0 ? '#10B981' : parseFloat(stock.net_debt_to_ebitda) < 2 ? '#2563EB' : '#EF4444'} />
            <KpiCard label="Current Ratio" value={`${fmt(stock.current_ratio, 2)}×`} metric="current_ratio" />
          </div>

          <div className="detail-grid">
            <div className="card">
              <h3 className="card-title">Valuační ukazatele</h3>
              <div className="valuation-grid">
                <ValBox label="EV / Sales" value={`${fmt(stock.ev_to_sales, 2)}×`} metric="ev_to_sales" />
                <ValBox label="EV / FCF" value={`${fmt(stock.ev_to_fcf, 1)}×`} metric="ev_to_fcf" />
                <ValBox label="Dluh / EBITDA" value={`${fmt(stock.net_debt_to_ebitda, 2)}×`} metric="net_debt_to_ebitda" />
                <ValBox label="Current Ratio" value={`${fmt(stock.current_ratio, 2)}×`} metric="current_ratio" />
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Kvalita podnikání</h3>
              <div className="valuation-grid">
                <ValBox label="ROIC" value={fmtPct(stock.roic)} metric="roic" />
                <ValBox label="Hrubá marže" value={fmtPct(stock.gross_margin)} metric="gross_margin" />
                <ValBox label="FCF marže" value={fmtPct(stock.fcf_margin)} metric="fcf_margin" />
                <ValBox label="Růst tržeb" value={fmtPct(stock.revenue_growth)} metric="revenue_growth" />
              </div>
            </div>

            {dcf && (
              <div className="card">
                <h3 className="card-title">DCF Model</h3>
                <div className="dcf-visual">
                  <div className="dcf-bar-wrap">
                    <div className="dcf-bar-label">Aktuální cena</div>
                    <div className="dcf-bar-track">
                      <div className="dcf-bar-fill dcf-bar--price"
                        style={{ width: `${Math.min(100, dcf.current_price / Math.max(dcf.current_price, dcf.estimated_fair_value) * 100)}%` }} />
                    </div>
                    <div className="dcf-bar-val">${fmt(dcf.current_price)}</div>
                  </div>
                  <div className="dcf-bar-wrap">
                    <div className="dcf-bar-label">Férová hodnota</div>
                    <div className="dcf-bar-track">
                      <div className="dcf-bar-fill dcf-bar--fair"
                        style={{ width: `${Math.min(100, dcf.estimated_fair_value / Math.max(dcf.current_price, dcf.estimated_fair_value) * 100)}%` }} />
                    </div>
                    <div className="dcf-bar-val">${fmt(dcf.estimated_fair_value)}</div>
                  </div>
                </div>
                <div className="dcf-assumptions">
                  <div className="assump-row"><span>Růst tržeb:</span><strong>{dcf.assumptions?.growth_rate} %</strong></div>
                  <div className="assump-row"><span>Diskontní sazba:</span><strong>{dcf.assumptions?.discount_rate} %</strong></div>
                  <div className="assump-row"><span>Terminální růst:</span><strong>{dcf.assumptions?.terminal_growth} %</strong></div>
                </div>
                <div className={`dcf-rating dcf-rating--${dcf.rating === 'Strong Buy' || dcf.rating === 'Buy' ? 'buy' : dcf.rating === 'Hold' ? 'hold' : 'sell'}`}>
                  {dcf.rating}
                </div>
                <div className="ai-comment">{dcf.ai_comment}</div>
              </div>
            )}
          </div>

          {peers.length > 0 && (
            <div className="card mt-20">
              <h3 className="card-title">Srovnání se sektorem — {stock.sector}</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>EV/Sales</th>
                      <th>EV/FCF</th>
                      <th>ROIC</th>
                      <th>Hrubá marže</th>
                      <th>FCF marže</th>
                      <th>Composite</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="highlight-row">
                      <td><span className="ticker-badge">{stock.ticker}</span> ← vybraný</td>
                      <td className="num">{fmt(stock.ev_to_sales, 2)}×</td>
                      <td className="num">{fmt(stock.ev_to_fcf, 1)}×</td>
                      <td className="num">{fmtPct(stock.roic)}</td>
                      <td className="num">{fmtPct(stock.gross_margin)}</td>
                      <td className="num">{fmtPct(stock.fcf_margin)}</td>
                      <td className="num" style={{ color: scoreColor(stock.composite_score), fontWeight: 700 }}>{fmt(stock.composite_score, 1)}</td>
                    </tr>
                    {peers.map(p => (
                      <tr key={p.ticker}>
                        <td><span className="ticker-badge ticker-badge--gray">{p.ticker}</span></td>
                        <td className="num">{fmt(p.ev_to_sales, 2)}×</td>
                        <td className="num">{fmt(p.ev_to_fcf, 1)}×</td>
                        <td className="num">{fmtPct(p.roic)}</td>
                        <td className="num">{fmtPct(p.gross_margin)}</td>
                        <td className="num">{fmtPct(p.fcf_margin)}</td>
                        <td className="num" style={{ color: scoreColor(p.composite_score), fontWeight: 700 }}>{fmt(p.composite_score, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dcf?.projected_fcf_per_share && (
            <div className="charts-row mt-20">
              <div className="card">
                <h3 className="card-title">Projekce FCF – liniový trend</h3>
                <SvgLineChart data={dcf.projected_fcf_per_share} labels={['Rok 1', 'Rok 2', 'Rok 3', 'Rok 4', 'Rok 5']} color="#2563EB" />
              </div>
              <div className="card">
                <h3 className="card-title">Marže &amp; výnosy (aktuální)</h3>
                <SvgBarChart
                  data={[
                    parseFloat(stock.gross_margin) * 100,
                    parseFloat(stock.fcf_margin) * 100,
                    parseFloat(stock.roic) * 100,
                    parseFloat(stock.revenue_growth) * 100,
                  ].map(v => isNaN(v) ? 0 : v)}
                  labels={['Hrubá', 'FCF', 'ROIC', 'Růst']}
                  color="#10B981"
                  formatFn={v => `${v.toFixed(0)}%`}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// PAGE: FINANCIAL STATEMENTS
// ============================================================
function FinancialStatementsPage() {
  const [inputVal, setInputVal] = useState('')
  const [stock, setStock] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const load = async (t) => {
    const sym = t.trim().toUpperCase()
    if (!sym) return
    setLoading(true); setErr(null)
    try {
      const data = await fetch(`${API}/stock/${sym}`).then(r => { if (!r.ok) throw new Error(`${sym} nenalezen`); return r.json() })
      setStock(data)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  // Estimate N-year history from current values using growth rate
  const genTrend = (current, growth, years = 6) => {
    const g = parseFloat(growth) || 0.05
    const cur = parseFloat(current) || 0
    return Array.from({ length: years }, (_, i) => {
      const yearsAgo = years - 1 - i
      return parseFloat((cur / Math.pow(1 + g, yearsAgo)).toFixed(4))
    })
  }

  return (
    <div className="page">
      <h1 className="page-title">Finanční výkazy</h1>
      <div className="search-bar">
        <input className="search-input" placeholder="Zadej ticker…"
          value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(inputVal)} />
        <button className="btn-primary" onClick={() => load(inputVal)}>Načíst výkazy</button>
      </div>
      {loading && <Loading />}
      {err && <ErrorMsg msg={err} />}
      {stock && (
        <>
          <div className="stock-header">
            <h2>{stock.company}</h2>
            <span className="ticker-badge">{stock.ticker}</span>
            <span className="info-badge">Data: TTM (Trailing 12 Months)</span>
          </div>
          <div className="kpi-row">
            <KpiCard label="Hrubá marže" value={fmtPct(stock.gross_margin)} metric="gross_margin" color="#2563EB" />
            <KpiCard label="FCF marže" value={fmtPct(stock.fcf_margin)} metric="fcf_margin" color="#10B981" />
            <KpiCard label="Růst tržeb" value={fmtPct(stock.revenue_growth)} metric="revenue_growth" color="#F59E0B" />
            <KpiCard label="ROIC" value={fmtPct(stock.roic)} metric="roic" color="#8B5CF6" />
          </div>

          <div className="statements-grid">
            <div className="card">
              <h3 className="card-title">📊 Income Statement</h3>
              <table className="statement-table">
                <thead><tr><th>Ukazatel</th><th>Hodnota (TTM)</th><th>Hodnocení</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Růst tržeb YoY</td>
                    <td className="num" style={{ color: parseFloat(stock.revenue_growth) >= 0.05 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{fmtPct(stock.revenue_growth)}</td>
                    <td><ScoreBar value={Math.max(0, parseFloat(stock.revenue_growth) * 100)} max={30} color="#2563EB" /></td>
                  </tr>
                  <tr>
                    <td>Hrubá marže</td>
                    <td className="num" style={{ color: '#10B981', fontWeight: 600 }}>{fmtPct(stock.gross_margin)}</td>
                    <td><ScoreBar value={parseFloat(stock.gross_margin) * 100} max={100} color="#10B981" /></td>
                  </tr>
                  <tr>
                    <td>Růst EPS YoY</td>
                    <td className="num" style={{ color: parseFloat(stock.eps_growth) >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{fmtPct(stock.eps_growth)}</td>
                    <td><ScoreBar value={Math.max(0, parseFloat(stock.eps_growth) * 100)} max={60} color="#2563EB" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 className="card-title">🏦 Balance Sheet</h3>
              <table className="statement-table">
                <thead><tr><th>Ukazatel</th><th>Hodnota (TTM)</th><th>Hodnocení</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Čistý dluh / EBITDA</td>
                    <td className="num" style={{ color: parseFloat(stock.net_debt_to_ebitda) < 1.5 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{fmt(stock.net_debt_to_ebitda, 2)}×</td>
                    <td><ScoreBar value={Math.max(0, 4 - parseFloat(stock.net_debt_to_ebitda))} max={4} color="#10B981" /></td>
                  </tr>
                  <tr>
                    <td>Current Ratio</td>
                    <td className="num" style={{ color: parseFloat(stock.current_ratio) > 1.2 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{fmt(stock.current_ratio, 2)}×</td>
                    <td><ScoreBar value={Math.min(parseFloat(stock.current_ratio) || 0, 4)} max={4} color="#2563EB" /></td>
                  </tr>
                  <tr>
                    <td>EV / Sales</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmt(stock.ev_to_sales, 2)}×</td>
                    <td><ScoreBar value={Math.max(0, 15 - parseFloat(stock.ev_to_sales))} max={15} color="#F59E0B" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 className="card-title">💰 Cash Flow Statement</h3>
              <table className="statement-table">
                <thead><tr><th>Ukazatel</th><th>Hodnota (TTM)</th><th>Hodnocení</th></tr></thead>
                <tbody>
                  <tr>
                    <td>FCF marže</td>
                    <td className="num" style={{ color: parseFloat(stock.fcf_margin) >= 0.1 ? '#10B981' : '#F59E0B', fontWeight: 600 }}>{fmtPct(stock.fcf_margin)}</td>
                    <td><ScoreBar value={parseFloat(stock.fcf_margin) * 100} max={50} color="#10B981" /></td>
                  </tr>
                  <tr>
                    <td>ROIC</td>
                    <td className="num" style={{ color: parseFloat(stock.roic) >= 0.15 ? '#10B981' : '#F59E0B', fontWeight: 600 }}>{fmtPct(stock.roic)}</td>
                    <td><ScoreBar value={parseFloat(stock.roic) * 100} max={50} color="#8B5CF6" /></td>
                  </tr>
                  <tr>
                    <td>EV / FCF</td>
                    <td className="num" style={{ color: parseFloat(stock.ev_to_fcf) < 25 ? '#10B981' : '#EF4444', fontWeight: 600 }}>{fmt(stock.ev_to_fcf, 1)}×</td>
                    <td><ScoreBar value={Math.max(0, 50 - parseFloat(stock.ev_to_fcf))} max={50} color="#F59E0B" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="charts-row mt-20">
            <div className="card">
              <h3 className="card-title">Klíčové marže a výnosy (%)</h3>
              <SvgBarChart
                data={[
                  parseFloat(stock.gross_margin) * 100,
                  parseFloat(stock.fcf_margin) * 100,
                  parseFloat(stock.roic) * 100,
                  parseFloat(stock.revenue_growth) * 100,
                  parseFloat(stock.eps_growth) * 100,
                ].map(v => isNaN(v) ? 0 : v)}
                labels={['Hrubá', 'FCF', 'ROIC', 'Růst tržeb', 'Růst EPS']}
                color="#2563EB"
                formatFn={v => `${v.toFixed(0)}%`}
              />
            </div>
            <div className="card">
              <h3 className="card-title">Odhadovaný vývoj FCF marže (odhad z aktuálních dat)</h3>
              <SvgLineChart
                data={genTrend(parseFloat(stock.fcf_margin) * 100, parseFloat(stock.revenue_growth))}
                labels={['-5r', '-4r', '-3r', '-2r', '-1r', 'TTM']}
                color="#10B981"
              />
              <p className="hint-text">* Graf je odhadem historického trendu na základě aktuálního TTM a tempa růstu tržeb.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// PAGE: DIVIDENDY
// ============================================================
const DIVIDEND_DB = {
  JNJ:  { yield_pct: 3.1, freq: 'Čtvrtletně', exDiv: '2026-02-18', payDate: '2026-03-04', annualPerShare: 4.96, payout: 55 },
  KO:   { yield_pct: 3.0, freq: 'Čtvrtletně', exDiv: '2026-03-14', payDate: '2026-04-01', annualPerShare: 1.94, payout: 68 },
  PG:   { yield_pct: 2.3, freq: 'Čtvrtletně', exDiv: '2026-04-19', payDate: '2026-05-15', annualPerShare: 3.76, payout: 59 },
  MCD:  { yield_pct: 2.4, freq: 'Čtvrtletně', exDiv: '2026-02-28', payDate: '2026-03-17', annualPerShare: 6.68, payout: 57 },
  MSFT: { yield_pct: 0.8, freq: 'Čtvrtletně', exDiv: '2026-02-20', payDate: '2026-03-13', annualPerShare: 3.00, payout: 25 },
  AAPL: { yield_pct: 0.5, freq: 'Čtvrtletně', exDiv: '2026-02-07', payDate: '2026-02-13', annualPerShare: 1.00, payout: 15 },
  VZ:   { yield_pct: 6.5, freq: 'Čtvrtletně', exDiv: '2026-04-09', payDate: '2026-05-01', annualPerShare: 2.66, payout: 85 },
  T:    { yield_pct: 5.2, freq: 'Čtvrtletně', exDiv: '2026-04-09', payDate: '2026-05-01', annualPerShare: 1.11, payout: 60 },
  O:    { yield_pct: 5.8, freq: 'Měsíčně',    exDiv: '2026-03-31', payDate: '2026-04-15', annualPerShare: 3.12, payout: 75 },
  ABBV: { yield_pct: 3.8, freq: 'Čtvrtletně', exDiv: '2026-04-14', payDate: '2026-05-15', annualPerShare: 6.20, payout: 47 },
  BMY:  { yield_pct: 4.8, freq: 'Čtvrtletně', exDiv: '2026-04-03', payDate: '2026-05-01', annualPerShare: 2.48, payout: 55 },
  WMT:  { yield_pct: 1.0, freq: 'Čtvrtletně', exDiv: '2026-03-14', payDate: '2026-04-01', annualPerShare: 0.83, payout: 31 },
  HD:   { yield_pct: 2.4, freq: 'Čtvrtletně', exDiv: '2026-03-12', payDate: '2026-03-27', annualPerShare: 9.00, payout: 52 },
  JPM:  { yield_pct: 2.1, freq: 'Čtvrtletně', exDiv: '2026-04-04', payDate: '2026-04-30', annualPerShare: 4.60, payout: 30 },
  XOM:  { yield_pct: 3.5, freq: 'Čtvrtletně', exDiv: '2026-02-14', payDate: '2026-03-10', annualPerShare: 3.96, payout: 44 },
  CVX:  { yield_pct: 4.2, freq: 'Čtvrtletně', exDiv: '2026-02-19', payDate: '2026-03-10', annualPerShare: 6.52, payout: 58 },
}

function DividendyPage() {
  const [positions, setPositions] = useState([
    { ticker: 'KO', shares: 50, invested: 3200 },
    { ticker: 'JNJ', shares: 20, invested: 2900 },
    { ticker: 'O',   shares: 80, invested: 4000 },
  ])
  const [newTicker, setNewTicker] = useState('')
  const [newShares, setNewShares] = useState('')
  const [newInvested, setNewInvested] = useState('')

  const addPosition = () => {
    const t = newTicker.trim().toUpperCase()
    const s = parseFloat(newShares) || 0
    const inv = parseFloat(newInvested) || 0
    if (!t || s <= 0) return
    setPositions(prev => [...prev, { ticker: t, shares: s, invested: inv }])
    setNewTicker(''); setNewShares(''); setNewInvested('')
  }
  const removePosition = i => setPositions(prev => prev.filter((_, idx) => idx !== i))

  const rows = positions.map(p => {
    const db = DIVIDEND_DB[p.ticker] ?? null
    return {
      ...p,
      db,
      annualDiv: db ? db.annualPerShare * p.shares : null,
      per100: db ? db.yield_pct : null,
    }
  })

  const totalAnnual = rows.reduce((s, r) => s + (r.annualDiv ?? 0), 0)
  const totalInvested = rows.reduce((s, r) => s + (r.invested ?? 0), 0)
  const portYield = totalInvested > 0 ? (totalAnnual / totalInvested * 100).toFixed(2) : '—'

  return (
    <div className="page">
      <h1 className="page-title">Dividendový tracker</h1>
      <div className="kpi-row">
        <KpiCard label="Roční dividendy" value={`$${totalAnnual.toFixed(0)}`} color="#10B981" icon="💵" />
        <KpiCard label="Měsíční příjem" value={`$${(totalAnnual / 12).toFixed(0)}`} color="#2563EB" icon="📅" />
        <KpiCard label="Celkem investováno" value={`$${fmtNum(totalInvested)}`} icon="💼" />
        <KpiCard label="Yield portfolia" value={`${portYield} %`} color="#F59E0B" icon="📈" />
      </div>

      <div className="card mb-20">
        <h3 className="card-title">Přidat dividendovou pozici</h3>
        <div className="add-position-row">
          <input className="search-input" style={{ flex: 2 }} placeholder="Ticker (KO, JNJ, O…)"
            value={newTicker} onChange={e => setNewTicker(e.target.value)} />
          <input className="search-input" style={{ flex: 1 }} placeholder="Počet akcií" type="number"
            value={newShares} onChange={e => setNewShares(e.target.value)} />
          <input className="search-input" style={{ flex: 1 }} placeholder="Investováno ($)" type="number"
            value={newInvested} onChange={e => setNewInvested(e.target.value)} />
          <button className="btn-primary" onClick={addPosition}>Přidat</button>
        </div>
        <p className="hint-text">Dostupné tickery: {Object.keys(DIVIDEND_DB).join(', ')}</p>
      </div>

      <div className="card">
        <h3 className="card-title">Dividendové pozice</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Akcie</th>
                <th>Yield</th>
                <th>Na $100</th>
                <th>Roč. dividenda</th>
                <th>Měsíčně</th>
                <th>Ex-Div datum</th>
                <th>Výplatní datum</th>
                <th>Frekvence</th>
                <th>Payout ratio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><span className="ticker-badge">{r.ticker}</span></td>
                  <td className="num">{r.shares}</td>
                  <td className="num" style={{ color: '#10B981', fontWeight: 700 }}>{r.db ? `${r.db.yield_pct} %` : '—'}</td>
                  <td className="num" style={{ color: '#2563EB', fontWeight: 600 }}>{r.per100 ? `$${r.per100.toFixed(2)}` : '—'}</td>
                  <td className="num" style={{ color: '#10B981', fontWeight: 700 }}>{r.annualDiv ? `$${r.annualDiv.toFixed(2)}` : '—'}</td>
                  <td className="num">{r.annualDiv ? `$${(r.annualDiv / 12).toFixed(2)}` : '—'}</td>
                  <td>{r.db?.exDiv ?? '—'}</td>
                  <td>{r.db?.payDate ?? '—'}</td>
                  <td>{r.db?.freq ?? '—'}</td>
                  <td>
                    {r.db ? (
                      <div className="payout-bar">
                        <div style={{ flex: 1, height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${r.db.payout}%`, background: r.db.payout > 80 ? '#EF4444' : '#10B981', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{r.db.payout} %</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td><button className="btn-danger-sm" onClick={() => removePosition(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {rows.some(r => r.annualDiv) && (
        <div className="charts-row mt-20">
          <div className="card">
            <h3 className="card-title">Roční dividendy podle pozice</h3>
            <SvgBarChart
              data={rows.filter(r => r.annualDiv).map(r => r.annualDiv)}
              labels={rows.filter(r => r.annualDiv).map(r => r.ticker)}
              color="#10B981"
              formatFn={v => `$${v.toFixed(0)}`}
            />
          </div>
          <div className="card">
            <h3 className="card-title">Dividend yield podle pozice</h3>
            <SvgBarChart
              data={rows.filter(r => r.db).map(r => r.db.yield_pct)}
              labels={rows.filter(r => r.db).map(r => r.ticker)}
              color="#2563EB"
              formatFn={v => `${v.toFixed(1)}%`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// PAGE: PORTFOLIO
// ============================================================
const SECTOR_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

function PortfolioPage() {
  const [positions, setPositions] = useState([
    { ticker: 'NVDA', shares: 10, buy_price: 500 },
    { ticker: 'MSFT', shares: 5,  buy_price: 380 },
    { ticker: 'ADBE', shares: 3,  buy_price: 400 },
  ])
  const [newTicker, setNewTicker] = useState('')
  const [newShares, setNewShares] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const addPosition = () => {
    const t = newTicker.trim().toUpperCase()
    const s = parseFloat(newShares) || 0
    const p = parseFloat(newPrice) || 0
    if (!t || s <= 0 || p <= 0) return
    setPositions(prev => [...prev, { ticker: t, shares: s, buy_price: p }])
    setNewTicker(''); setNewShares(''); setNewPrice('')
  }
  const removePosition = i => setPositions(prev => prev.filter((_, idx) => idx !== i))

  const analyze = async () => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`${API}/portfolio/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio: positions }),
      })
      if (!res.ok) throw new Error('Chyba analýzy portfolia')
      setResult(await res.json())
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <h1 className="page-title">Portfolio tracker</h1>

      <div className="card mb-20">
        <h3 className="card-title">Přidat pozici</h3>
        <div className="add-position-row">
          <input className="search-input" style={{ flex: 2 }} placeholder="Ticker (NVDA, AAPL…)"
            value={newTicker} onChange={e => setNewTicker(e.target.value)} />
          <input className="search-input" style={{ flex: 1 }} placeholder="Počet akcií" type="number"
            value={newShares} onChange={e => setNewShares(e.target.value)} />
          <input className="search-input" style={{ flex: 1 }} placeholder="Nákupní cena ($)" type="number"
            value={newPrice} onChange={e => setNewPrice(e.target.value)} />
          <button className="btn-primary" onClick={addPosition}>Přidat</button>
        </div>
        <div className="portfolio-input-list">
          {positions.map((p, i) => (
            <div key={i} className="portfolio-input-item">
              <span className="ticker-badge">{p.ticker}</span>
              <span>{p.shares} akcií @ ${p.buy_price}</span>
              <button className="btn-danger-sm" onClick={() => removePosition(i)}>×</button>
            </div>
          ))}
        </div>
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={analyze} disabled={loading}>
          {loading ? 'Analyzuji…' : '📊 Analyzovat portfolio'}
        </button>
      </div>

      {err && <ErrorMsg msg={err} />}

      {result && (
        <>
          <div className="kpi-row">
            <KpiCard label="Celková hodnota" value={`$${fmtNum(result.portfolio_summary.total_value)}`} icon="💼" />
            <KpiCard
              label="Celkový P/L"
              value={`${result.portfolio_summary.total_profit >= 0 ? '+' : ''}$${fmtNum(result.portfolio_summary.total_profit)}`}
              color={result.portfolio_summary.total_profit >= 0 ? '#10B981' : '#EF4444'}
              sub={`${result.portfolio_summary.total_profit_pct >= 0 ? '+' : ''}${fmt(result.portfolio_summary.total_profit_pct, 1)} %`}
              icon={result.portfolio_summary.total_profit >= 0 ? '📈' : '📉'}
            />
            <KpiCard
              label="Portfolio Score"
              value={fmt(result.portfolio_summary.portfolio_score, 1)}
              metric="composite_score"
              color={scoreColor(result.portfolio_summary.portfolio_score)}
            />
            <KpiCard label="Počet pozic" value={result.portfolio_summary.positions_count} icon="📋" />
            <KpiCard label="Celková cena" value={`$${fmtNum(result.portfolio_summary.total_cost)}`} icon="💰" />
          </div>

          <div className="card">
            <h3 className="card-title">Pozice v portfoliu</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Sektor</th>
                    <th>Akcie</th>
                    <th>Nák. cena</th>
                    <th>Akt. cena</th>
                    <th>Hodnota</th>
                    <th>P/L $</th>
                    <th>P/L %</th>
                    <th>Composite</th>
                    <th>Signál</th>
                  </tr>
                </thead>
                <tbody>
                  {result.positions.map(p => (
                    <tr key={p.ticker}>
                      <td><span className="ticker-badge">{p.ticker}</span></td>
                      <td><span className="sector-tag">{p.sector}</span></td>
                      <td className="num">{p.shares}</td>
                      <td className="num">${fmt(p.buy_price)}</td>
                      <td className="num">${fmt(p.current_price)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>${fmtNum(p.current_value)}</td>
                      <td className="num" style={{ color: p.profit_loss >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                        {p.profit_loss >= 0 ? '+' : ''}${fmtNum(p.profit_loss)}
                      </td>
                      <td className="num" style={{ color: p.profit_loss_pct >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                        {p.profit_loss_pct >= 0 ? '+' : ''}{fmt(p.profit_loss_pct, 1)} %
                      </td>
                      <td className="num" style={{ color: scoreColor(p.composite_score), fontWeight: 700 }}>{fmt(p.composite_score, 1)}</td>
                      <td><span className="signal-badge" style={{ background: signalColor(p.signal) }}>{p.signal}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="charts-row mt-20">
            <div className="card">
              <h3 className="card-title">P/L výnos podle pozice (%)</h3>
              <SvgBarChart
                data={result.positions.map(p => p.profit_loss_pct)}
                labels={result.positions.map(p => p.ticker)}
                color="#2563EB"
                formatFn={v => `${v.toFixed(1)}%`}
              />
            </div>
            {result.sector_diversification.length > 0 && (
              <div className="card">
                <h3 className="card-title">Sektorová diverzifikace</h3>
                <SvgDonutChart
                  data={result.sector_diversification.map(s => s.weight_pct)}
                  labels={result.sector_diversification.map(s => s.sector)}
                  colors={SECTOR_COLORS}
                />
              </div>
            )}
          </div>

          <div className="card mt-20">
            <h3 className="card-title">🤖 AI komentář</h3>
            <div className="ai-comment-large">{result.ai_comment}</div>
          </div>

          {result.missing_tickers.length > 0 && (
            <div className="warning-box mt-20">⚠ Tickery nenalezeny v databázi: {result.missing_tickers.join(', ')}</div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// PAGE: WATCHLIST
// ============================================================
function WatchlistPage() {
  const [watchlist, setWatchlist] = useState(['NVDA', 'MSFT', 'GOOGL', 'META', 'ADBE'])
  const [inputVal, setInputVal] = useState('')
  const [result, setResult] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const addTicker = () => {
    const t = inputVal.trim().toUpperCase()
    if (t && !watchlist.includes(t)) { setWatchlist(prev => [...prev, t]); setInputVal('') }
  }
  const removeTicker = t => setWatchlist(prev => prev.filter(x => x !== t))

  const analyze = async () => {
    setLoading(true); setErr(null)
    try {
      const [r, a] = await Promise.all([
        fetch(`${API}/watchlist/analyze`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: watchlist }),
        }).then(r => { if (!r.ok) throw new Error('Chyba analýzy'); return r.json() }),
        fetch(`${API}/watchlist/alerts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: watchlist }),
        }).then(r => r.ok ? r.json() : null),
      ])
      setResult(r); setAlerts(a)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const avgScore = result?.items?.length
    ? (result.items.reduce((s, x) => s + parseFloat(x.composite_score || 0), 0) / result.items.length).toFixed(1)
    : '—'

  return (
    <div className="page">
      <h1 className="page-title">Watchlist</h1>
      <div className="card mb-20">
        <h3 className="card-title">Spravovat watchlist</h3>
        <div className="add-position-row">
          <input className="search-input" style={{ flex: 1 }} placeholder="Přidat ticker…"
            value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTicker()} />
          <button className="btn-primary" onClick={addTicker}>Přidat</button>
          <button className="btn-secondary" onClick={analyze} disabled={loading}>
            {loading ? 'Analyzuji…' : '🔍 Analyzovat watchlist'}
          </button>
        </div>
        <div className="ticker-chips">
          {watchlist.map(t => (
            <div key={t} className="ticker-chip">
              {t}
              <button onClick={() => removeTicker(t)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {err && <ErrorMsg msg={err} />}

      {result && (
        <>
          <div className="kpi-row">
            <KpiCard label="Sledováno" value={result.count} icon="👀" />
            <KpiCard label="Prům. Composite Score" value={avgScore} metric="composite_score" />
            <KpiCard label="BUY signály" value={result.items.filter(x => String(x.signal).toUpperCase() === 'BUY').length} color="#10B981" icon="📈" />
            {alerts && <KpiCard label="Alerty" value={alerts.count} color="#F59E0B" icon="🔔" />}
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px 0', fontWeight: 700, fontSize: 14, color: '#1E293B' }}>Přehled sledovaných akcií</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Společnost</th>
                    <th>Sektor</th>
                    <th>Cena</th>
                    <th>Signál</th>
                    <th>Composite</th>
                    <th>Quality</th>
                    <th>Overheat</th>
                    <th>ROIC</th>
                    <th>Hrubá marže</th>
                    <th>FCF marže</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(s => (
                    <tr key={s.ticker}>
                      <td><span className="ticker-badge">{s.ticker}</span></td>
                      <td style={{ maxWidth: 180 }}>{s.company}</td>
                      <td><span className="sector-tag">{s.sector}</span></td>
                      <td className="num">${fmt(s.price)}</td>
                      <td><span className="signal-badge" style={{ background: signalColor(s.signal) }}>{s.signal}</span></td>
                      <td className="num" style={{ color: scoreColor(s.composite_score), fontWeight: 700 }}>{fmt(s.composite_score, 1)}</td>
                      <td className="num">{fmt(s.quality_score, 0)}</td>
                      <td className="num">{fmt(s.overheat_score, 0)}</td>
                      <td className="num">{fmtPct(s.roic)}</td>
                      <td className="num">{fmtPct(s.gross_margin)}</td>
                      <td className="num">{fmtPct(s.fcf_margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {alerts?.alerts?.length > 0 && (
            <div className="section mt-20">
              <h2 className="section-title">Alerty pro watchlist</h2>
              <div className="alerts-grid">
                {alerts.alerts.map((a, i) => (
                  <div key={i} className={`alert-card alert-${a.type.toLowerCase()}`}>
                    <div className="alert-header">
                      <span className="alert-ticker">{a.ticker}</span>
                      <span className="alert-type">{a.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="alert-company">{a.company}</div>
                    <div className="alert-msg">{a.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.missing_tickers.length > 0 && (
            <div className="warning-box mt-20">⚠ Nenalezeno: {result.missing_tickers.join(', ')}</div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================
// NAV
// ============================================================
const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Přehled',           icon: '🏠' },
  { id: 'scanner',     label: 'Skener signálů',    icon: '📡' },
  { id: 'detail',      label: 'Detail akcie',      icon: '🔍' },
  { id: 'valuation',   label: 'Deep Valuation',    icon: '📊' },
  { id: 'statements',  label: 'Finanční výkazy',   icon: '📋' },
  { id: 'dividendy',   label: 'Dividendy',         icon: '💵' },
  { id: 'portfolio',   label: 'Portfolio',         icon: '💼' },
  { id: 'watchlist',   label: 'Watchlist',         icon: '👀' },
]

// ============================================================
// APP
// ============================================================
export default function App() {
  const [page, setPage] = useState('dashboard')
  const [open, setOpen] = useState(true)

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return <DashboardPage />
      case 'scanner':    return <ScannerPage />
      case 'detail':     return <StockDetailPage />
      case 'valuation':  return <DeepValuationPage />
      case 'statements': return <FinancialStatementsPage />
      case 'dividendy':  return <DividendyPage />
      case 'portfolio':  return <PortfolioPage />
      case 'watchlist':  return <WatchlistPage />
      default:           return <DashboardPage />
    }
  }

  return (
    <div className="app">
      <aside className={`sidebar${open ? '' : ' sidebar--closed'}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">📈</span>
          {open && <span className="logo-text">AI Invest</span>}
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${page === item.id ? ' nav-item--active' : ''}`}
              onClick={() => setPage(item.id)}
              title={!open ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {open && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <button className="sidebar-toggle" onClick={() => setOpen(o => !o)}>
          {open ? '◀' : '▶'}
        </button>
      </aside>
      <main className="main" style={{ marginLeft: open ? 'var(--sidebar-w)' : 'var(--sidebar-closed-w)' }}>
        {renderPage()}
      </main>
    </div>
  )
}
