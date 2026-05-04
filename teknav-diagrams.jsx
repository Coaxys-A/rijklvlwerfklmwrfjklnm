// teknav-diagrams.jsx — SVG-based interactive diagrams (ES module)
import { useState, useEffect, useRef } from 'react';

// ── Neural Network Diagram ──────────────────────────────────────────────────
function NeuralNetworkDiagram({ width = 420, height = 280 }) {
  const [hovered, setHovered] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 80); return () => clearInterval(id); }, []);

  const layers = [
    { x: 60, nodes: [80, 130, 180, 230], label: 'لایه ورودی' },
    { x: 160, nodes: [100, 155, 210], label: 'لایه پنهان ۱' },
    { x: 260, nodes: [110, 165, 220], label: 'لایه توجه' },
    { x: 360, nodes: [140, 195], label: 'خروجی مدل' },
  ];

  const pulses = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const from = layers[li], to = layers[li + 1];
    from.nodes.forEach((fy, fi) => {
      to.nodes.forEach((ty, ti) => {
        const phase = (tick + li * 7 + fi * 3 + ti * 5) % 40;
        if (phase < 20) pulses.push({ x: from.x + (to.x - from.x) * phase / 20, y: fy + (ty - fy) * phase / 20 });
      });
    });
  }

  const nodeColors = ['#0F6B73', '#D49A2A', '#C76D4A', '#2F8F6B'];

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      {layers.map((layer, li) =>
        layers[li + 1] && layer.nodes.map((fy, fi) =>
          layers[li + 1].nodes.map((ty, ti) => (
            <line key={`${li}-${fi}-${ti}`} x1={layer.x} y1={fy} x2={layers[li+1].x} y2={ty}
              stroke="#E4DDD2" strokeWidth="1" opacity="0.6" />
          ))
        )
      )}
      {pulses.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#D49A2A" opacity="0.75" />
      ))}
      {layers.map((layer, li) =>
        layer.nodes.map((y, ni) => (
          <g key={`n-${li}-${ni}`} onMouseEnter={() => setHovered(`${li}-${ni}`)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            <circle cx={layer.x} cy={y} r={hovered === `${li}-${ni}` ? 13 : 10} fill={nodeColors[li]} opacity={hovered === `${li}-${ni}` ? 1 : 0.85}
              style={{ transition: 'r 0.15s' }} />
            {hovered === `${li}-${ni}` && (
              <g>
                <rect x={layer.x - 60} y={y - 30} width="120" height="22" rx="4" fill="#20343A" opacity="0.9" />
                <text x={layer.x} y={y - 15} textAnchor="middle" fill="#FAF7F0" fontSize="10">{layer.label}</text>
              </g>
            )}
          </g>
        ))
      )}
      {layers.map((layer, li) => (
        <text key={`l-${li}`} x={layer.x} y={height - 8} textAnchor="middle" fill="#5F6B6D" fontSize="9">{layer.label}</text>
      ))}
    </svg>
  );
}

// ── Data Pipeline Diagram ───────────────────────────────────────────────────
function DataPipelineDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState(null);
  useEffect(() => { const id = setInterval(() => setTick(t => (t + 1) % 100), 60); return () => clearInterval(id); }, []);

  const steps = [
    { id: 'raw', label: 'داده خام', icon: '⬡', color: '#5F6B6D', desc: 'جمع‌آوری از منابع مختلف' },
    { id: 'clean', label: 'پاک‌سازی', icon: '◈', color: '#D49A2A', desc: 'حذف تکراری و نویز' },
    { id: 'label', label: 'برچسب‌گذاری', icon: '◉', color: '#C76D4A', desc: 'دسته‌بندی و تعریف' },
    { id: 'feature', label: 'ویژگی‌سازی', icon: '⬟', color: '#0F6B73', desc: 'استخراج ویژگی' },
    { id: 'train', label: 'آموزش مدل', icon: '◈', color: '#2F8F6B', desc: 'یادگیری از داده' },
    { id: 'eval', label: 'ارزیابی', icon: '◉', color: '#D49A2A', desc: 'سنجش عملکرد' },
    { id: 'output', label: 'خروجی', icon: '★', color: '#0F6B73', desc: 'مدل آماده' },
  ];

  const W = compact ? 480 : 700, H = compact ? 140 : 180;
  const stepW = W / steps.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Vazirmatn, sans-serif', overflow: 'visible' }}>
      {/* Connector line */}
      <line x1={stepW * 0.5} y1={H / 2} x2={W - stepW * 0.5} y2={H / 2} stroke="#E4DDD2" strokeWidth="2" />
      {/* Animated particles */}
      {[0, 25, 50, 75].map(offset => {
        const pos = ((tick + offset) % 100) / 100;
        const x = stepW * 0.5 + pos * (W - stepW);
        return <circle key={offset} cx={x} cy={H / 2} r="4" fill="#D49A2A" opacity={0.8} />;
      })}
      {steps.map((step, i) => {
        const cx = stepW * (i + 0.5);
        const isHov = hovered === step.id;
        return (
          <g key={step.id} onMouseEnter={() => setHovered(step.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={H / 2} r={isHov ? 26 : 22} fill={step.color} opacity={isHov ? 1 : 0.85} style={{ transition: 'all 0.2s' }} />
            <text x={cx} y={H / 2 + 5} textAnchor="middle" fill="#fff" fontSize={compact ? 11 : 13} fontWeight="700">{i + 1}</text>
            <text x={cx} y={H / 2 + (compact ? 36 : 42)} textAnchor="middle" fill="#263238" fontSize={compact ? 9 : 10}>{step.label}</text>
            {isHov && (
              <g>
                <rect x={cx - 55} y={H / 2 - 52} width="110" height="22" rx="4" fill="#20343A" opacity="0.92" />
                <text x={cx} y={H / 2 - 37} textAnchor="middle" fill="#FAF7F0" fontSize="9">{step.desc}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Cybersecurity Diagram ───────────────────────────────────────────────────
function CyberSecurityDiagram() {
  const [hovered, setHovered] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 100); return () => clearInterval(id); }, []);

  const cx = 200, cy = 150, r = 90;
  const threats = [
    { angle: 0, label: 'فیشینگ', color: '#C94C4C' },
    { angle: 60, label: 'حمله زنجیره تأمین', color: '#D08A22' },
    { angle: 120, label: 'آسیب‌پذیری کتابخانه', color: '#C76D4A' },
    { angle: 180, label: 'دسترسی غیرمجاز', color: '#C94C4C' },
    { angle: 240, label: 'باج‌افزار', color: '#D08A22' },
    { angle: 300, label: 'حمله DDoS', color: '#C76D4A' },
  ];

  return (
    <svg width="100%" viewBox="0 0 400 300" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      {/* Shield ring */}
      <circle cx={cx} cy={cy} r={55} fill="none" stroke="#2F8F6B" strokeWidth="2.5" strokeDasharray="8 4"
        style={{ animation: 'spin 20s linear infinite', transformOrigin: `${cx}px ${cy}px` }} />
      {/* Center server */}
      <rect x={cx - 22} y={cy - 28} width="44" height="56" rx="6" fill="#20343A" />
      <rect x={cx - 16} y={cy - 22} width="32" height="6" rx="2" fill="#0F6B73" />
      <rect x={cx - 16} y={cy - 12} width="32" height="6" rx="2" fill="#0F6B73" />
      <rect x={cx - 16} y={cy - 2} width="32" height="6" rx="2" fill="#0F6B73" />
      <circle cx={cx + 12} cy={cy + 16} r="3" fill="#2F8F6B" />
      <text x={cx} y={cy + 42} textAnchor="middle" fill="#5F6B6D" fontSize="9">سرور مرکزی</text>

      {threats.map((t, i) => {
        const rad = (t.angle * Math.PI) / 180;
        const tx = cx + Math.cos(rad) * r;
        const ty = cy + Math.sin(rad) * r;
        const lx = cx + Math.cos(rad) * (r + 38);
        const ly = cy + Math.sin(rad) * (r + 38);
        const isH = hovered === i;
        const pulse = (tick + i * 6) % 30 < 15;
        return (
          <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            <line x1={cx + Math.cos(rad) * 55} y1={cy + Math.sin(rad) * 55} x2={tx} y2={ty}
              stroke={t.color} strokeWidth={isH ? 2 : 1} strokeDasharray={pulse ? '6 3' : '3 6'} opacity={0.7} />
            <circle cx={tx} cy={ty} r={isH ? 10 : 8} fill={t.color} opacity={isH ? 1 : 0.75} style={{ transition: 'all 0.15s' }} />
            {isH && (
              <g>
                <rect x={lx - 55} y={ly - 14} width="110" height="20" rx="4" fill="#20343A" opacity="0.92" />
                <text x={lx} y={ly - 1} textAnchor="middle" fill="#FAF7F0" fontSize="9">{t.label}</text>
              </g>
            )}
          </g>
        );
      })}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

// ── Startup Growth Diagram ──────────────────────────────────────────────────
function StartupGrowthDiagram() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let v = 0;
    const id = setInterval(() => { v = Math.min(v + 2, 100); setProgress(v); if (v >= 100) clearInterval(id); }, 20);
    return () => clearInterval(id);
  }, []);

  const milestones = ['ایده', 'محصول اولیه', 'جذب کاربر', 'درآمد', 'مقیاس‌پذیری'];
  const W = 400, H = 200, padX = 40, padY = 20;
  const points = milestones.map((_, i) => {
    const t = i / (milestones.length - 1);
    return { x: padX + t * (W - padX * 2), y: H - padY - Math.pow(t, 1.8) * (H - padY * 3) };
  });

  const drawProgress = Math.min(progress / 100, 1);
  const pathPoints = points.filter((_, i) => i / (milestones.length - 1) <= drawProgress + 0.01);

  const pathD = pathPoints.length > 1
    ? pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 30}`} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="#E4DDD2" strokeWidth="1.5" />
      <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="#E4DDD2" strokeWidth="1.5" />
      {pathD && <path d={pathD} fill="none" stroke="#0F6B73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Fill area */}
      {pathPoints.length > 1 && (
        <path d={`${pathD} L ${pathPoints[pathPoints.length-1].x} ${H - padY} L ${pathPoints[0].x} ${H - padY} Z`}
          fill="#0F6B73" opacity="0.08" />
      )}
      {points.map((p, i) => {
        const t = i / (milestones.length - 1);
        const visible = t <= drawProgress + 0.01;
        return visible ? (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="7" fill="#D49A2A" />
            <text x={p.x} y={H + 15} textAnchor="middle" fill="#5F6B6D" fontSize="9">{milestones[i]}</text>
          </g>
        ) : null;
      })}
      <text x={W / 2} y={padY - 5} textAnchor="middle" fill="#263238" fontSize="10" fontWeight="600">منحنی رشد استارتاپ</text>
    </svg>
  );
}

// ── Hardware Chip Diagram ───────────────────────────────────────────────────
function HardwareChipDiagram() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 70); return () => clearInterval(id); }, []);

  const blocks = [
    { x: 30, y: 60, w: 80, h: 40, label: 'حافظه', color: '#D49A2A' },
    { x: 160, y: 40, w: 80, h: 80, label: 'پردازنده', color: '#0F6B73' },
    { x: 290, y: 60, w: 80, h: 40, label: 'شتاب‌دهنده AI', color: '#C76D4A' },
    { x: 30, y: 150, w: 80, h: 40, label: 'گذرگاه داده', color: '#2F8F6B' },
    { x: 290, y: 150, w: 80, h: 40, label: 'کنترلر حافظه', color: '#5F6B6D' },
  ];

  const routes = [
    { x1: 110, y1: 80, x2: 160, y2: 80 },
    { x1: 240, y1: 80, x2: 290, y2: 80 },
    { x1: 110, y1: 170, x2: 160, y2: 120 },
    { x1: 240, y1: 100, x2: 290, y2: 170 },
    { x1: 200, y1: 120, x2: 200, y2: 170 },
  ];

  return (
    <svg width="100%" viewBox="0 0 400 220" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <rect x="10" y="20" width="380" height="190" rx="8" fill="#F4EFE6" stroke="#E4DDD2" strokeWidth="1.5" />
      {routes.map((r, i) => {
        const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
        const phase = ((tick + i * 12) % 40) / 40;
        const px = r.x1 + (r.x2 - r.x1) * phase;
        const py = r.y1 + (r.y2 - r.y1) * phase;
        return (
          <g key={i}>
            <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#E4DDD2" strokeWidth="3" />
            <circle cx={px} cy={py} r="4" fill="#D49A2A" opacity="0.9" />
          </g>
        );
      })}
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="5" fill={b.color} opacity="0.85" />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="600">{b.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Future Timeline Diagram ─────────────────────────────────────────────────
function FutureTimelineDiagram() {
  const [activeIdx, setActiveIdx] = useState(null);
  const milestones = [
    { year: '۲۰۲۵', label: 'AGI اولیه', color: '#0F6B73' },
    { year: '۲۰۲۷', label: 'رایانش کوانتومی', color: '#D49A2A' },
    { year: '۲۰۲۹', label: 'رباتیک خودکار', color: '#C76D4A' },
    { year: '۲۰۳۱', label: 'رابط مغز-ماشین', color: '#2F8F6B' },
    { year: '۲۰۳۵', label: 'جوش هسته‌ای تجاری', color: '#0F6B73' },
  ];
  const W = 480, H = 120;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <line x1={40} y1={H / 2} x2={W - 40} y2={H / 2} stroke="#E4DDD2" strokeWidth="2" />
      {milestones.map((m, i) => {
        const x = 40 + (i / (milestones.length - 1)) * (W - 80);
        const isH = activeIdx === i;
        return (
          <g key={i} onMouseEnter={() => setActiveIdx(i)} onMouseLeave={() => setActiveIdx(null)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={H / 2} r={isH ? 14 : 10} fill={m.color} style={{ transition: 'r 0.15s' }} />
            <text x={x} y={H / 2 - 22} textAnchor="middle" fill={m.color} fontSize="10" fontWeight="700">{m.year}</text>
            {isH && (
              <g>
                <rect x={x - 55} y={H / 2 + 20} width="110" height="22" rx="4" fill="#20343A" opacity="0.9" />
                <text x={x} y={H / 2 + 34} textAnchor="middle" fill="#FAF7F0" fontSize="9">{m.label}</text>
              </g>
            )}
            {!isH && <text x={x} y={H / 2 + 26} textAnchor="middle" fill="#5F6B6D" fontSize="8.5">{m.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Software Architecture Diagram ───────────────────────────────────────────
function SoftwareArchDiagram() {
  const modules = [
    { x: 180, y: 30, label: 'API Gateway', color: '#0F6B73' },
    { x: 60, y: 110, label: 'Auth Service', color: '#2F8F6B' },
    { x: 180, y: 110, label: 'Core Service', color: '#D49A2A' },
    { x: 300, y: 110, label: 'AI Service', color: '#C76D4A' },
    { x: 60, y: 190, label: 'Database', color: '#5F6B6D' },
    { x: 300, y: 190, label: 'Cache', color: '#5F6B6D' },
  ];
  const edges = [[0,1],[0,2],[0,3],[1,4],[2,4],[3,5]];
  return (
    <svg width="100%" viewBox="0 0 420 250" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      {edges.map(([a, b], i) => (
        <line key={i} x1={modules[a].x + 50} y1={modules[a].y + 18} x2={modules[b].x + 50} y2={modules[b].y + 18}
          stroke="#E4DDD2" strokeWidth="1.5" markerEnd="url(#arr)" />
      ))}
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#E4DDD2" />
        </marker>
      </defs>
      {modules.map((m, i) => (
        <g key={i}>
          <rect x={m.x} y={m.y} width="100" height="36" rx="6" fill={m.color} opacity="0.85" />
          <text x={m.x + 50} y={m.y + 22} textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="600">{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Diagram Renderer ────────────────────────────────────────────────────────
function WaveStreamDiagram() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 40); return () => clearInterval(id); }, []);
  const W = 480, H = 160;
  const streams = [
    { color: '#D49A2A', amp: 28, freq: 0.022, phase: 0, y: 50 },
    { color: '#C46A4D', amp: 20, freq: 0.03, phase: 1.5, y: 85 },
    { color: '#2F8F6B', amp: 24, freq: 0.018, phase: 3, y: 120 },
  ];
  const buildPath = (s) => {
    const pts = Array.from({ length: 60 }, (_, i) => {
      const x = (i / 59) * W;
      const y = s.y + s.amp * Math.sin(x * s.freq + tick * 0.08 + s.phase);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(' ');
  };
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Vazirmatn,sans-serif' }}>
      <defs>
        {streams.map((s, i) => (
          <linearGradient key={i} id={`wg${i}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={s.color} stopOpacity="0" />
            <stop offset="30%" stopColor={s.color} stopOpacity="0.9" />
            <stop offset="70%" stopColor={s.color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {streams.map((s, i) => (
        <g key={i}>
          <path d={buildPath(s)} fill="none" stroke={`url(#wg${i})`} strokeWidth={2.5} />
          {/* Travelling dot */}
          {(() => {
            const pct = ((tick * 1.8 + i * 80) % 480) / 480;
            const x = pct * W;
            const y = s.y + s.amp * Math.sin(x * s.freq + tick * 0.08 + s.phase);
            return <circle cx={x} cy={y} r={4} fill={s.color} opacity={0.9} />;
          })()}
        </g>
      ))}
      <text x={W / 2} y={H - 4} textAnchor="middle" fill="#5F6B6D" fontSize="9">جریان داده در شبکه</text>
    </svg>
  );
}

function OrbitDiagram() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 50); return () => clearInterval(id); }, []);
  const cx = 140, cy = 110;
  const orbits = [
    { r: 40, speed: 0.04, color: '#D49A2A', label: 'داده', dotR: 7 },
    { r: 65, speed: -0.025, color: '#C46A4D', label: 'مدل', dotR: 9 },
    { r: 90, speed: 0.016, color: '#2F8F6B', label: 'استنتاج', dotR: 8 },
  ];
  return (
    <svg width="100%" viewBox="0 0 280 220" style={{ fontFamily: 'Vazirmatn,sans-serif' }}>
      {/* Center core */}
      <circle cx={cx} cy={cy} r={22} fill="#20343A" />
      <circle cx={cx} cy={cy} r={16} fill="#0F6B73" opacity={0.8} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#FAF7F0" fontSize="8" fontWeight="700">AI</text>
      {/* Orbit rings */}
      {orbits.map((o, i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={o.r} fill="none" stroke={o.color} strokeWidth="1" strokeDasharray="4 6" opacity="0.35" />
          {(() => {
            const angle = tick * o.speed;
            const x = cx + o.r * Math.cos(angle);
            const y = cy + o.r * Math.sin(angle);
            return (
              <g>
                <circle cx={x} cy={y} r={o.dotR} fill={o.color} opacity={0.9} />
                <text x={x} y={y + o.dotR + 10} textAnchor="middle" fill={o.color} fontSize="8" fontWeight="600">{o.label}</text>
              </g>
            );
          })()}
        </g>
      ))}
    </svg>
  );
}

// ── Diagram Renderer ────────────────────────────────────────────────────────
function GeneratedDiagram({ variant = 1, compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 50); return () => clearInterval(id); }, []);
  const W = compact ? 320 : 520;
  const H = compact ? 150 : 210;
  const seed = Number.isFinite(variant) ? variant : 1;
  const nodeCount = 6 + (seed % 7);
  const radius = compact ? 36 + (seed % 5) * 6 : 48 + (seed % 6) * 7;
  const centerX = W * 0.5;
  const centerY = H * 0.48;
  const palette = ['#0F6B73', '#D49A2A', '#C76D4A', '#2F8F6B', '#5F6B6D'];
  const points = Array.from({ length: nodeCount }, (_, i) => {
    const angle = ((Math.PI * 2) / nodeCount) * i + (seed % 9) * 0.11;
    return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, color: palette[(i + seed) % palette.length] };
  });
  const pulse = (tick + seed * 3) % 100;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Vazirmatn,sans-serif' }}>
      <rect x="8" y="8" width={W - 16} height={H - 16} rx="12" fill="#F4EFE6" stroke="#E4DDD2" />
      {points.map((a, i) => points.slice(i + 1).map((b, j) => (
        <line key={`${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E4DDD2" strokeWidth={((i + j + seed) % 3) + 0.5} opacity={0.5} />
      )))}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={6 + ((i + seed) % 4)} fill={p.color} opacity={0.9} />
          <circle cx={p.x} cy={p.y} r={((pulse + i * 7) % 22) + 8} fill="none" stroke={p.color} opacity={0.16} />
        </g>
      ))}
      <text x={W / 2} y={H - 10} textAnchor="middle" fill="#5F6B6D" fontSize="9">Generated Diagram {String(seed).padStart(2, '0')}</text>
    </svg>
  );
}

// ── Brain / Neural Interface Diagram ───────────────────────────────────────
function BrainDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60); return () => clearInterval(id); }, []);
  const W = compact ? 300 : 400, H = compact ? 180 : 260;
  const cx = W / 2, cy = H * 0.45;
  const nodes = [
    { x: cx, y: cy - 60 }, { x: cx - 50, y: cy - 30 }, { x: cx + 50, y: cy - 30 },
    { x: cx - 70, y: cy + 20 }, { x: cx + 70, y: cy + 20 }, { x: cx, y: cy + 60 },
    { x: cx - 30, y: cy + 40 }, { x: cx + 30, y: cy + 40 }
  ];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <defs>
        <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0F6B73" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0F6B73" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={80} fill="url(#brainGlow)" />
      {nodes.map((n1, i) => nodes.slice(i + 1).map((n2, j) => {
        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist > 100) return null;
        return <line key={`${i}-${j}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#0F6B73" strokeWidth="1" opacity="0.3" />;
      }))}
      {nodes.map((n, i) => {
        const pulse = Math.sin(tick * 0.1 + i) * 3 + 6;
        return <circle key={i} cx={n.x} cy={n.y} r={pulse} fill="#0F6B73" opacity="0.8" />;
      })}
      <text x={cx} y={H - 10} textAnchor="middle" fill="#5F6B6D" fontSize="10" fontWeight="600">رابط عصبی هوشمند</text>
    </svg>
  );
}

// ── Database / Vector DB Diagram ────────────────────────────────────────────
function DatabaseDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 50); return () => clearInterval(id); }, []);
  const W = 320, H = 200;
  const stacks = [
    { x: 60, y: 140, h: 40, color: '#5F6B6D' },
    { x: 160, y: 140, h: 60, color: '#D49A2A' },
    { x: 260, y: 140, h: 50, color: '#0F6B73' },
  ];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      {stacks.map((s, i) => (
        <g key={i}>
          <rect x={s.x - 25} y={s.y - s.h} width="50" height={s.h} fill={s.color} opacity="0.8" rx="4" />
          <ellipse cx={s.x} cy={s.y - s.h} rx="25" ry="8" fill={s.color} />
          <ellipse cx={s.x} cy={s.y} rx="25" ry="8" fill={s.color} stroke="#FAF7F0" strokeWidth="1" />
        </g>
      ))}
      <path d="M 60 80 Q 160 30 260 80" fill="none" stroke="#D49A2A" strokeWidth="2" strokeDasharray="5 5">
        <animate attributeName="stroke-dashoffset" from="40" to="0" dur="2s" repeatCount="indefinite" />
      </path>
      <text x={W / 2} y={H - 5} textAnchor="middle" fill="#5F6B6D" fontSize="10">ساختار داده‌های برداری</text>
    </svg>
  );
}

// ── Cloud / Edge Infrastructure Diagram ─────────────────────────────────────
function CloudDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 80); return () => clearInterval(id); }, []);
  return (
    <svg width="100%" viewBox="0 0 400 220" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <path d="M100,100 Q120,60 180,70 T260,100 T340,100 T300,140 L140,140 Z" fill="#F4EFE6" stroke="#0F6B73" strokeWidth="2" opacity="0.6" />
      {[0, 1, 2].map(i => {
        const x = 150 + i * 50, y = 110;
        const pulse = (tick + i * 10) % 20 < 10;
        return <rect key={i} x={x} y={y} width="30" height="15" rx="3" fill={pulse ? '#D49A2A' : '#5F6B6D'} opacity="0.9" />;
      })}
      <text x="200" y="170" textAnchor="middle" fill="#5F6B6D" fontSize="10">رایانش ابری و لبه شبکه</text>
    </svg>
  );
}

// ── Quantum Entanglement Diagram ────────────────────────────────────────────
function QuantumDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 40); return () => clearInterval(id); }, []);
  const cx1 = 120, cy = 100, cx2 = 280;
  const orbit = tick * 0.05;
  return (
    <svg width="100%" viewBox="0 0 400 200" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <circle cx={cx1} cy={cy} r="30" fill="none" stroke="#2F8F6B" strokeWidth="1" strokeDasharray="4 4" />
      <circle cx={cx2} cy={cy} r="30" fill="none" stroke="#2F8F6B" strokeWidth="1" strokeDasharray="4 4" />
      <line x1={cx1} y1={cy} x2={cx2} y2={cy} stroke="#2F8F6B" strokeWidth="2" opacity="0.4" />
      <circle cx={cx1 + Math.cos(orbit) * 30} cy={cy + Math.sin(orbit) * 30} r="6" fill="#2F8F6B" />
      <circle cx={cx2 + Math.cos(orbit + Math.PI) * 30} cy={cy + Math.sin(orbit + Math.PI) * 30} r="6" fill="#2F8F6B" />
      <text x="200" y="160" textAnchor="middle" fill="#5F6B6D" fontSize="10">درهم‌تنیدگی کوانتومی</text>
    </svg>
  );
}

// ── VLA / Robotic Action Diagram ────────────────────────────────────────────
function VlaDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 50); return () => clearInterval(id); }, []);
  return (
    <svg width="100%" viewBox="0 0 400 220" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <g transform="translate(200, 100)">
        <rect x="-80" y="-40" width="160" height="80" rx="10" fill="#F4EFE6" stroke="#C76D4A" strokeWidth="2" />
        <text x="0" y="5" textAnchor="middle" fill="#C76D4A" fontSize="14" fontWeight="800">VLA MODEL</text>
        {/* Input lines */}
        <line x1="-120" y1="-20" x2="-80" y2="-20" stroke="#0F6B73" strokeWidth="2">
          <animate attributeName="stroke-dasharray" from="0,40" to="40,0" dur="1s" repeatCount="indefinite" />
        </line>
        <text x="-140" y="-17" textAnchor="middle" fill="#0F6B73" fontSize="9">Vision</text>
        <line x1="-120" y1="20" x2="-80" y2="20" stroke="#D49A2A" strokeWidth="2" />
        <text x="-140" y="23" textAnchor="middle" fill="#D49A2A" fontSize="9">Language</text>
        {/* Output lines */}
        <line x1="80" y1="0" x2="130" y2="0" stroke="#2F8F6B" strokeWidth="3" />
        <text x="150" y="4" textAnchor="middle" fill="#2F8F6B" fontSize="10" fontWeight="700">ACTION</text>
      </g>
    </svg>
  );
}

// ── Bio-Tech / DNA Diagram ────────────────────────────────────────────────
function DnaDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60); return () => clearInterval(id); }, []);
  const W = 320, H = 200;
  const nodes = Array.from({ length: 10 }, (_, i) => i);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      {nodes.map(i => {
        const y = 30 + i * 15;
        const x1 = 160 + Math.sin(tick * 0.1 + i * 0.8) * 40;
        const x2 = 160 - Math.sin(tick * 0.1 + i * 0.8) * 40;
        return (
          <g key={i}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke="#E4DDD2" strokeWidth="1" />
            <circle cx={x1} cy={y} r="5" fill="#C76D4A" />
            <circle cx={x2} cy={y} r="5" fill="#0F6B73" />
          </g>
        );
      })}
      <text x={W / 2} y={H - 5} textAnchor="middle" fill="#5F6B6D" fontSize="10">مهندسی ژنتیک و بیوتکنولوژی</text>
    </svg>
  );
}

// ── Energy / Fusion Diagram ───────────────────────────────────────────────
function FusionDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 40); return () => clearInterval(id); }, []);
  const cx = 160, cy = 100;
  return (
    <svg width="100%" viewBox="0 0 320 200" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <circle cx={cx} cy={cy} r="50" fill="none" stroke="#D49A2A" strokeWidth="2" strokeDasharray="5 5">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={20 + Math.sin(tick * 0.2) * 5} fill="#D49A2A" opacity="0.8">
        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1s" repeatCount="indefinite" />
      </circle>
      <text x={cx} y={cy + 75} textAnchor="middle" fill="#5F6B6D" fontSize="10">گداخت هسته‌ای و انرژی پاک</text>
    </svg>
  );
}

// ── Space / Satellite Diagram ─────────────────────────────────────────────
function SatelliteDiagram({ compact = false }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 50); return () => clearInterval(id); }, []);
  const cx = 160, cy = 100;
  const satX = cx + Math.cos(tick * 0.03) * 80;
  const satY = cy + Math.sin(tick * 0.03) * 40;
  return (
    <svg width="100%" viewBox="0 0 320 200" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      <circle cx={cx} cy={cy} r="30" fill="#0F6B73" opacity="0.6" />
      <ellipse cx={cx} cy={cy} rx="80" ry="40" fill="none" stroke="#E4DDD2" strokeWidth="1" />
      <g transform={`translate(${satX}, ${satY}) rotate(${tick * 1.7})`}>
        <rect x="-8" y="-4" width="16" height="8" fill="#5F6B6D" />
        <rect x="-15" y="-2" width="7" height="4" fill="#D49A2A" />
        <rect x="8" y="-2" width="7" height="4" fill="#D49A2A" />
      </g>
      <line x1={cx} y1={cy} x2={satX} y2={satY} stroke="#0F6B73" strokeWidth="1" strokeDasharray="2 2" />
      <text x={cx} y={H - 5} textAnchor="middle" fill="#5F6B6D" fontSize="10">ارتباطات ماهواره‌ای و فضا</text>
    </svg>
  );
}

// ── Fintech / Blockchain Diagram ──────────────────────────────────────────
function BlockchainDiagram({ compact = false }) {
  const blocks = [0, 1, 2, 3];
  return (
    <svg width="100%" viewBox="0 0 400 150" style={{ fontFamily: 'Vazirmatn, sans-serif' }}>
      {blocks.map(i => (
        <g key={i} transform={`translate(${40 + i * 90}, 50)`}>
          <rect width="60" height="50" rx="6" fill="#F4EFE6" stroke="#2F8F6B" strokeWidth="2" />
          <text x="30" y="30" textAnchor="middle" fill="#2F8F6B" fontSize="10" fontWeight="800">BLOCK {i}</text>
          {i < 3 && <line x1="60" y1="25" x2="90" y2="25" stroke="#2F8F6B" strokeWidth="2" strokeDasharray="4 2" />}
        </g>
      ))}
      <text x="200" y="130" textAnchor="middle" fill="#5F6B6D" fontSize="10">فناوری زنجیره بلوکی و فین‌تک</text>
    </svg>
  );
}

function DiagramRenderer({ type, compact = false }) {
  const map = {
    neural: NeuralNetworkDiagram,
    pipeline: DataPipelineDiagram,
    cyber: CyberSecurityDiagram,
    growth: StartupGrowthDiagram,
    chip: HardwareChipDiagram,
    timeline: FutureTimelineDiagram,
    arch: SoftwareArchDiagram,
    wave: WaveStreamDiagram,
    orbit: OrbitDiagram,
    brain: BrainDiagram,
    database: DatabaseDiagram,
    cloud: CloudDiagram,
    quantum: QuantumDiagram,
    vla: VlaDiagram,
    dna: DnaDiagram,
    fusion: FusionDiagram,
    satellite: SatelliteDiagram,
    blockchain: BlockchainDiagram
  };
  if (typeof type === 'string' && /^diagram-\d{3}$/.test(type)) {
    const variant = Number(type.split('-')[1]);
    return <GeneratedDiagram compact={compact} variant={variant} />;
  }
  const Comp = map[type] || NeuralNetworkDiagram;
  return <Comp compact={compact} />;
}

export { NeuralNetworkDiagram, DataPipelineDiagram, CyberSecurityDiagram, StartupGrowthDiagram, HardwareChipDiagram, FutureTimelineDiagram, SoftwareArchDiagram, WaveStreamDiagram, OrbitDiagram, GeneratedDiagram, DiagramRenderer };
