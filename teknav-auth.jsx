// teknav-auth.jsx — Login / Signup page
import { useState, useEffect } from 'react';
import { useAuth, useNav, useToast } from './teknav-ui.jsx';
import { ApiError } from './src/lib/api.js';
import { api } from './src/lib/api.js';
import TeknavCAP from './src/lib/TeknavCAP.jsx';

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useTimeGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'شب بخیر';
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'روز بخیر';
  if (h < 21) return 'عصر بخیر';
  return 'شب بخیر';
}

function useCountUp(target, delayMs = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const steps = 36;
      let step = 0;
      const iv = setInterval(() => {
        step++;
        const ease = 1 - Math.pow(1 - step / steps, 3);
        setCount(Math.floor(ease * target));
        if (step >= steps) { setCount(target); clearInterval(iv); }
      }, 1600 / steps);
      return () => clearInterval(iv);
    }, delayMs);
    return () => clearTimeout(t);
  }, [target, delayMs]);
  return count;
}

// ── Page-scoped CSS ───────────────────────────────────────────────────────────
function AuthStyles() {
  return (
    <style>{`
      @keyframes orbit  { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
      @keyframes orbitR { from{transform:rotate(0deg)}   to{transform:rotate(-360deg)} }
      @keyframes tickerUp { 0%{transform:translateY(0)} 100%{transform:translateY(-50%)} }
      @keyframes bgGrid {
        0%   { background-position: 0 0; }
        100% { background-position: 52px 52px; }
      }
      @keyframes logoGlow {
        0%,100% { box-shadow: 0 10px 36px rgba(200,149,28,0.35); }
        50%      { box-shadow: 0 10px 56px rgba(200,149,28,0.6), 0 0 80px rgba(200,149,28,0.15); }
      }
      @keyframes fadeSlideUp {
        from { opacity:0; transform:translateY(16px); }
        to   { opacity:1; transform:translateY(0); }
      }
      @keyframes statReveal {
        0%   { opacity:0; transform:scale(0.75) translateY(6px); }
        60%  { transform:scale(1.05) translateY(-2px); }
        100% { opacity:1; transform:scale(1) translateY(0); }
      }
      @keyframes dividerExpand {
        from { width: 0; opacity: 0; }
        to   { width: 48px; opacity: 1; }
      }
      @keyframes blink {
        0%,100% { opacity: 1; } 50% { opacity: 0.3; }
      }

      /* ── Layout ── */
      .auth-layout {
        display: flex; min-height: 100vh;
        direction: rtl; font-family: Vazirmatn, sans-serif;
      }
      .auth-form-col {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 48px 32px; min-height: 100vh;
        position: relative; overflow: hidden;
        background: #FAF7F0;
        background-image:
          linear-gradient(rgba(196,106,77,0.028) 1px, transparent 1px),
          linear-gradient(90deg, rgba(196,106,77,0.028) 1px, transparent 1px);
        background-size: 52px 52px;
        animation: bgGrid 38s linear infinite;
      }
      .auth-form-col::before {
        content: '';
        position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(ellipse 70% 50% at 50% 100%, rgba(250,240,235,0.7) 0%, transparent 100%);
      }
      .auth-brand-col {
        width: 440px; flex-shrink: 0;
        background: #0B2226;
        position: relative; overflow: hidden;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 60px 44px;
      }
      .auth-mobile-logo { display: none; }

      @media (max-width: 880px) {
        .auth-brand-col   { display: none; }
        .auth-mobile-logo { display: flex; }
        .auth-form-col    { padding: 36px 20px; }
      }

      /* ── Inputs ── */
      .auth-input-wrap input:focus {
        border-color: #C8951C !important;
        background: #fff !important;
        box-shadow: 0 0 0 3px rgba(200,149,28,0.1) !important;
      }

      /* ── Buttons ── */
      .auth-gold-btn:hover:not(:disabled) {
        opacity: 0.91;
        transform: translateY(-1px);
        box-shadow: 0 7px 22px rgba(200,149,28,0.38) !important;
      }
      .auth-gold-btn:active:not(:disabled) { transform: translateY(0); }
      .auth-oauth-btn:hover {
        border-color: #C46A4D !important;
        background: #FFFCFB !important;
      }
      .auth-tab-btn {
        flex: 1; padding: 10px 0; border: none; cursor: pointer;
        font-family: Vazirmatn, sans-serif; font-size: 13px; font-weight: 700;
        border-radius: 9px; transition: all 0.22s;
      }
      .auth-switch-link {
        background: none; border: none; cursor: pointer;
        color: #C46A4D; font-weight: 700;
        font-family: Vazirmatn, sans-serif; font-size: 13px;
        text-decoration: underline; text-underline-offset: 3px;
        transition: color 0.15s;
      }
      .auth-switch-link:hover { color: #C8951C; }
      .auth-forgot-btn {
        background: none; border: none; cursor: pointer;
        color: #9AA5A6; font-size: 12px;
        font-family: Vazirmatn, sans-serif;
        text-decoration: underline; text-underline-offset: 2px;
        padding: 0; transition: color 0.15s;
      }
      .auth-forgot-btn:hover { color: #C46A4D; }

      /* ── Chips ── */
      .req-chip {
        font-size: 10px; padding: 2px 8px; border-radius: 20px;
        display: inline-flex; align-items: center; gap: 3px;
        transition: all 0.25s; font-family: Vazirmatn, sans-serif;
      }

      /* ── Brand panel ── */
      .ticker-mask {
        -webkit-mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
        mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
      }
      .brand-stat { animation: statReveal 0.55s cubic-bezier(.34,1.56,.64,1) both; }
      .brand-stat:nth-child(2) { animation-delay: 0.18s; }
      .brand-stat:nth-child(3) { animation-delay: 0.33s; }
      .auth-card { animation: fadeSlideUp 0.45s cubic-bezier(.2,.8,.2,1) both; }
    `}</style>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

// ── Brand Panel ───────────────────────────────────────────────────────────────
const TICKER_TOPICS = [
  'هوش مصنوعی و آینده توسعه نرم‌افزار',
  'امنیت سایبری در دوران پس از کوانتوم',
  'پردازش ابری بومی‌سازی‌شده در ایران',
  'متن‌باز در اکوسیستم فارسی‌زبان',
  'زیرساخت‌های توزیع‌شده مقیاس‌پذیر',
  'یادگیری عمیق با مجموعه‌داده‌های فارسی',
  'معماری میکروسرویس در محیط تولید',
  'مدیریت داده در مقیاس پتابایت',
];

const BRAND_WORDS = [
  { text: 'هوش مصنوعی', s: 12, x: 6,  y: 12, spd: 3.2 },
  { text: 'ابر',         s: 10, x: 72, y: 22, spd: 4.1 },
  { text: 'امنیت',       s: 11, x: 18, y: 74, spd: 3.6 },
  { text: 'متن‌باز',     s: 10, x: 62, y: 84, spd: 4.5 },
  { text: 'پردازش',      s: 11, x: 4,  y: 48, spd: 3.9 },
  { text: 'شبکه',        s: 10, x: 76, y: 58, spd: 3.3 },
  { text: 'داده',        s: 12, x: 38, y: 8,  spd: 4.8 },
  { text: 'زیرساخت',    s: 10, x: 48, y: 91, spd: 3.7 },
];

function BrandTicker() {
  const doubled = [...TICKER_TOPICS, ...TICKER_TOPICS];
  return (
    <div className="ticker-mask" style={{ overflow: 'hidden', height: 92, width: '100%' }}>
      <div style={{ animation: 'tickerUp 22s linear infinite' }}>
        {doubled.map((item, i) => (
          <div key={i} style={{
            fontSize: 11, color: 'rgba(250,247,240,0.26)',
            padding: '5px 0', borderBottom: '1px solid rgba(250,247,240,0.04)',
            fontFamily: 'Vazirmatn,sans-serif',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: 'rgba(200,149,28,0.4)', fontSize: 7, flexShrink: 0 }}>◉</span>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandPanel() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const articles = useCountUp(23, 700);
  const readers  = useCountUp(8400, 1000);
  const series   = useCountUp(6, 1300);

  useEffect(() => {
    const h = (e) => setMouse({
      x: e.clientX / window.innerWidth  - 0.5,
      y: e.clientY / window.innerHeight - 0.5,
    });
    window.addEventListener('mousemove', h, { passive: true });
    return () => window.removeEventListener('mousemove', h);
  }, []);

  return (
    <div className="auth-brand-col">
      {/* Giant watermark letter */}
      <div aria-hidden style={{
        position: 'absolute', top: '-8%', left: '-14%',
        fontSize: 360, fontWeight: 900, lineHeight: 1,
        color: 'rgba(255,255,255,0.016)',
        fontFamily: 'PelakFA,Vazirmatn,sans-serif',
        userSelect: 'none', pointerEvents: 'none',
      }}>ت</div>

      {/* Dot grid */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.032) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Parallax glow — follows cursor */}
      <div aria-hidden style={{
        position: 'absolute', top: '18%', left: '50%',
        transform: `translate(-50%, 0) translate(${mouse.x * 18}px, ${mouse.y * 18}px)`,
        width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(200,149,28,0.14) 0%, transparent 70%)',
        transition: 'transform 0.9s cubic-bezier(.2,.8,.2,1)',
        pointerEvents: 'none',
      }} />

      {/* Terracotta accent glow */}
      <div aria-hidden style={{
        position: 'absolute', bottom: '-4%', left: '-4%',
        width: 220, height: 220,
        background: 'radial-gradient(circle, rgba(196,106,77,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Floating word bubbles — subtle parallax */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        transform: `translate(${mouse.x * -12}px, ${mouse.y * -12}px)`,
        transition: 'transform 0.8s cubic-bezier(.2,.8,.2,1)',
      }}>
        {BRAND_WORDS.map((w, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${w.x}%`, top: `${w.y}%`,
            fontSize: w.s, color: 'rgba(250,247,240,0.13)',
            fontFamily: 'Vazirmatn,sans-serif',
            padding: '3px 10px',
            border: '1px solid rgba(250,247,240,0.07)',
            borderRadius: 20, whiteSpace: 'nowrap',
            animation: `float-y ${w.spd}s ease-in-out infinite`,
            animationDelay: `${i * 0.38}s`,
          }}>{w.text}</div>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', textAlign: 'center' }}>

        {/* Orbital logo */}
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 28px' }}>
          {/* Outer dashed ring */}
          <div aria-hidden style={{
            position: 'absolute', inset: -46,
            border: '1px dashed rgba(200,149,28,0.08)',
            borderRadius: '50%', animation: 'orbit 44s linear infinite',
          }} />
          {/* Middle ring + orbiting dot */}
          <div aria-hidden style={{
            position: 'absolute', inset: -28,
            border: '1px solid rgba(200,149,28,0.2)',
            borderRadius: '50%', animation: 'orbitR 17s linear infinite',
          }}>
            <div style={{
              position: 'absolute', top: -4, left: '50%', marginLeft: -4,
              width: 8, height: 8, borderRadius: '50%',
              background: '#C8951C',
              boxShadow: '0 0 10px rgba(200,149,28,0.7)',
            }} />
          </div>
          {/* Inner ring + dot */}
          <div aria-hidden style={{
            position: 'absolute', inset: -14,
            border: '1px solid rgba(250,247,240,0.07)',
            borderRadius: '50%', animation: 'orbit 9s linear infinite',
          }}>
            <div style={{
              position: 'absolute', bottom: -3, left: '50%', marginLeft: -3,
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(250,247,240,0.3)',
            }} />
          </div>
          {/* Logo square */}
          <div style={{
            width: '100%', height: '100%', borderRadius: 26,
            background: 'linear-gradient(145deg, #C8951C 0%, #F4C36A 50%, #C8951C 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'logoGlow 4.5s ease-in-out infinite',
          }}>
            <span style={{ color: '#0B2226', fontSize: 44, fontWeight: 900, fontFamily: 'Vazirmatn,sans-serif' }}>ت</span>
          </div>
        </div>

        {/* Wordmark */}
        <div style={{
          fontFamily: 'PelakFA,Vazirmatn,sans-serif',
          fontSize: 50, fontWeight: 800, color: '#FAF7F0',
          lineHeight: 1, letterSpacing: '-1px', marginBottom: 5,
        }}>تکناو</div>
        <div style={{
          fontSize: 10, letterSpacing: '0.32em', fontWeight: 500,
          color: 'rgba(250,247,240,0.28)', marginBottom: 22,
        }}>TEKNAV · IR</div>

        {/* Animated divider */}
        <div style={{
          height: 1.5, margin: '0 auto 20px',
          background: 'linear-gradient(90deg, transparent, rgba(200,149,28,0.65), transparent)',
          animation: 'dividerExpand 1.2s ease 0.3s both',
        }} />

        {/* Tagline */}
        <p style={{
          fontSize: 14, fontFamily: 'Vazirmatn,sans-serif',
          color: 'rgba(250,247,240,0.55)', lineHeight: 2,
          direction: 'rtl', margin: '0 0 26px',
        }}>
          آخرین دانش فناوری،{' '}
          <span style={{ color: 'rgba(200,149,28,0.88)', fontWeight: 600 }}>اول به فارسی</span>
        </p>

        {/* Live stats — count-up */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 26 }}>
          {[
            { n: articles, label: 'مقاله',    delay: '0s',    suffix: '+' },
            { n: readers,  label: 'خواننده',  delay: '0.18s', suffix: '' },
            { n: series,   label: 'سری',      delay: '0.34s', suffix: '' },
          ].map(({ n, label, delay, suffix }) => (
            <div key={label} className="brand-stat" style={{ animationDelay: delay }}>
              <div style={{
                fontSize: 24, fontWeight: 900, color: '#FAF7F0', lineHeight: 1,
                fontFamily: 'PelakFA,Vazirmatn,sans-serif',
              }}>
                {n.toLocaleString('fa-IR')}{suffix}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(250,247,240,0.32)', marginTop: 5, letterSpacing: '0.05em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Divider + ticker */}
        <div style={{ borderTop: '1px solid rgba(250,247,240,0.06)', paddingTop: 16, marginBottom: 10 }}>
          <div style={{
            fontSize: 9, color: 'rgba(250,247,240,0.22)',
            letterSpacing: '0.2em', marginBottom: 10, textTransform: 'uppercase',
          }}>موضوعات داغ</div>
          <BrandTicker />
        </div>

        {/* Online pulse indicator */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10,
          fontSize: 10, color: 'rgba(250,247,240,0.27)',
          fontFamily: 'Vazirmatn,sans-serif',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#2F8F6B', flexShrink: 0,
            boxShadow: '0 0 0 0 rgba(47,143,107,0.4)',
            animation: 'pulseRing 2.2s infinite',
            display: 'inline-block',
          }} />
          در حال حاضر آنلاین
        </div>
      </div>
    </div>
  );
}

// ── AuthInput ─────────────────────────────────────────────────────────────────
function AuthInput({ label, hint, error, suffix, inputProps = {} }) {
  const { style: inputStyle, ...rest } = inputProps;
  return (
    <div>
      {label && (
        <label style={{
          display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600,
          color: error ? '#C94C4C' : '#7B8C8E', letterSpacing: '0.03em',
        }}>{label}</label>
      )}
      <div style={{ position: 'relative' }} className="auth-input-wrap">
        <input {...rest} style={{
          width: '100%',
          padding: suffix ? '13px 16px 13px 46px' : '13px 16px',
          border: `1.5px solid ${error ? '#C94C4C' : '#E4DDD2'}`,
          borderRadius: 10, fontSize: 14,
          fontFamily: 'Vazirmatn,sans-serif',
          background: '#FAFAF8', color: '#1A2E30',
          outline: 'none',
          transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
          ...(inputStyle || {}),
        }} />
        {suffix && (
          <div style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: '#9AA5A6', display: 'flex', alignItems: 'center',
          }}>{suffix}</div>
        )}
      </div>
      {hint && !error && <div style={{ fontSize: 11, color: '#9AA5A6', marginTop: 4, lineHeight: 1.6 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#C94C4C', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ── Password strength ─────────────────────────────────────────────────────────
function PasswordStrength({ pw }) {
  const checks = [
    { label: '۸+ کاراکتر', ok: pw.length >= 8 },
    { label: 'حرف کوچک',   ok: /[a-z]/.test(pw) },
    { label: 'حرف بزرگ',   ok: /[A-Z]/.test(pw) },
    { label: 'عدد',         ok: /[0-9]/.test(pw) },
    { label: 'نماد',        ok: /[^a-zA-Z0-9]/.test(pw) },
  ];
  const score = checks.filter(c => c.ok).length;
  const barColor = score <= 2 ? '#C94C4C' : score === 3 ? '#D08A22' : '#2F8F6B';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= score ? barColor : '#E8E2D8',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {checks.map(({ label, ok }) => (
          <span key={label} className="req-chip" style={{
            background: ok ? 'rgba(47,143,107,0.09)' : '#F2EFE9',
            color:      ok ? '#2F8F6B' : '#9AA5A6',
            border:     `1px solid ${ok ? 'rgba(47,143,107,0.22)' : '#E4DDD2'}`,
          }}>{ok ? '✓' : '·'} {label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Forgot password modal ─────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast('ایمیل را وارد کنید', 'error'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch {
      toast('خطا در ارسال ایمیل. لطفاً دوباره تلاش کنید', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,34,38,0.62)' }} />
      <div style={{
        position: 'relative', background: '#FAF7F0', borderRadius: 18, padding: '36px 32px',
        maxWidth: 400, width: '90%', direction: 'rtl',
        boxShadow: '0 32px 80px rgba(0,0,0,0.24)', fontFamily: 'Vazirmatn,sans-serif',
        border: '1px solid #E4DDD2', animation: 'fadeSlideUp 0.25s ease both',
      }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#1A2E30', fontFamily: 'PelakFA,Vazirmatn,sans-serif' }}>بازیابی رمز عبور</h3>
        <p style={{ fontSize: 13, color: '#7B8C8E', margin: '0 0 20px', lineHeight: 1.7 }}>
          {sent
            ? 'اگر این ایمیل در سیستم ثبت شده باشد، لینک بازنشانی برای شما ارسال خواهد شد.'
            : 'آدرس ایمیل ثبت‌شده خود را وارد کنید.'}
        </p>
        {sent ? (
          <button onClick={onClose} style={goldBtn(false)}>بستن</button>
        ) : (
          <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AuthInput
              label="ایمیل"
              inputProps={{
                type: 'email', value: email, onChange: e => setEmail(e.target.value),
                placeholder: 'you@example.com', autoComplete: 'email',
                style: { direction: 'ltr', textAlign: 'left' },
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} style={cancelBtn}>انصراف</button>
              <button type="submit" disabled={loading} style={{ ...goldBtn(loading), flex: 1 }}>
                {loading ? '…' : 'ارسال لینک'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const { login } = useAuth();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ captchaId: '', userSolution: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { toast('نام کاربری/ایمیل و رمز عبور الزامی است', 'error'); return; }
    if (!captcha.captchaId || !captcha.userSolution.trim()) { toast('کد امنیتی را وارد کنید', 'error'); return; }
    setLoading(true);
    try {
      const user = await login(identifier, password, captcha.captchaId, captcha.userSolution);
      if (user) onSuccess(user);
      else toast('ایمیل یا رمز عبور نادرست است', 'error');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) toast('تعداد تلاش‌های ناموفق از حد مجاز گذشت. چند دقیقه صبر کنید', 'error');
        else if (err.status === 401) toast('نام کاربری، ایمیل یا رمز عبور نادرست است', 'error');
        else if (err.status === 403) toast('این حساب غیرفعال است', 'error');
        else if (err.status === 400) toast('کد امنیتی نامعتبر است — کد جدید دریافت کنید', 'error');
        else toast('خطا در اتصال به سرور', 'error');
      } else toast('خطای غیرمنتظره', 'error');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <AuthInput
        label="نام کاربری یا ایمیل"
        inputProps={{
          type: 'text', value: identifier, onChange: e => setIdentifier(e.target.value),
          placeholder: '@username یا you@example.com', autoComplete: 'username',
          style: { direction: 'ltr', textAlign: 'left' },
        }}
      />
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#7B8C8E', letterSpacing: '0.03em' }}>رمز عبور</label>
          <button type="button" onClick={() => setShowForgot(true)} className="auth-forgot-btn">فراموشی رمز؟</button>
        </div>
        <AuthInput
          inputProps={{
            type: showPass ? 'text' : 'password', value: password,
            onChange: e => setPassword(e.target.value),
            placeholder: '••••••••', autoComplete: 'current-password',
            style: { direction: 'ltr', textAlign: 'left' },
          }}
          suffix={
            <button type="button" onClick={() => setShowPass(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#9AA5A6' }}>
              <EyeIcon open={showPass} />
            </button>
          }
        />
      </div>
      <TeknavCAP onChange={setCaptcha} />
      <button type="submit" disabled={loading} className="auth-gold-btn" style={goldBtn(loading)}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(15,42,46,0.25)', borderTopColor: '#0F2A2E', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            در حال ورود...
          </span>
        ) : 'ورود به حساب'}
      </button>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </form>
  );
}

// ── Signup form ───────────────────────────────────────────────────────────────
function SignupForm({ onSuccess }) {
  const { signup } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState('email');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [captcha, setCaptcha] = useState({ captchaId: '', userSolution: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const isPhone = identifierType === 'phone';
  const pwMatch   = confirmPw && password === confirmPw;
  const pwMismatch = confirmPw && password !== confirmPw;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast('نام الزامی است', 'error'); return; }
    if (!/^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/.test(username.trim().toLowerCase().replace(/^@/, ''))) {
      toast('نام کاربری معتبر وارد کنید', 'error'); return;
    }
    if (!identifier.trim()) { toast(isPhone ? 'شماره موبایل الزامی است' : 'ایمیل الزامی است', 'error'); return; }
    if (password.length < 8) { toast('رمز عبور باید حداقل ۸ کاراکتر باشد', 'error'); return; }
    if (password !== confirmPw) { toast('رمزهای عبور تطابق ندارند', 'error'); return; }
    if (!captcha.captchaId || !captcha.userSolution.trim()) { toast('کد امنیتی را وارد کنید', 'error'); return; }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        username: username.trim().toLowerCase().replace(/^@/, ''),
        password, captchaId: captcha.captchaId, userSolution: captcha.userSolution,
        ...(isPhone ? { phone: identifier.trim() } : { email: identifier.trim().toLowerCase() }),
      };
      const user = await signup(payload);
      if (user) onSuccess(user);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          const msg = err.body?.error;
          toast(msg === 'username_taken' ? 'این نام کاربری قبلاً گرفته شده است' : isPhone ? 'این شماره قبلاً ثبت شده است' : 'این ایمیل قبلاً ثبت شده است', 'error');
        } else if (err.status === 429) {
          toast('تعداد ثبت‌نام از این آی‌پی زیاد است. کمی صبر کنید', 'error');
        } else if (err.status === 400) {
          toast(err.body?.error === 'invalid_captcha' ? 'کد امنیتی نامعتبر است' : 'اطلاعات وارد‌شده معتبر نیست', 'error');
        } else toast('خطا در اتصال به سرور', 'error');
      } else toast('خطای غیرمنتظره', 'error');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      <AuthInput
        label="نام نمایشی"
        inputProps={{
          type: 'text', value: name, onChange: e => setName(e.target.value),
          placeholder: 'مثال: علی رضایی', autoComplete: 'name',
        }}
      />
      <AuthInput
        label="نام کاربری"
        hint={username ? `پروفایل: @${username.replace(/^@/, '')}` : 'فقط حروف لاتین، عدد، نقطه و زیرخط'}
        inputProps={{
          type: 'text', value: username,
          onChange: e => setUsername(e.target.value.toLowerCase().replace(/^@/, '')),
          placeholder: 'ali_rezaei', autoComplete: 'username',
          style: { direction: 'ltr', textAlign: 'left' },
        }}
      />
      <div>
        <div style={{ display: 'flex', background: '#F0EDE6', borderRadius: 8, padding: 3, gap: 3, marginBottom: 9, width: 'fit-content' }}>
          {[{ key: 'email', label: 'ایمیل' }, { key: 'phone', label: 'موبایل' }].map(t => (
            <button key={t.key} type="button" onClick={() => { setIdentifierType(t.key); setIdentifier(''); }}
              style={{
                padding: '5px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
                background: identifierType === t.key ? '#fff' : 'transparent',
                color: identifierType === t.key ? '#1A2E30' : '#9AA5A6',
                boxShadow: identifierType === t.key ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
                transition: 'all 0.18s',
              }}>{t.label}</button>
          ))}
        </div>
        <AuthInput
          inputProps={{
            type: isPhone ? 'tel' : 'email', value: identifier,
            onChange: e => setIdentifier(e.target.value),
            placeholder: isPhone ? '09123456789' : 'you@example.com',
            autoComplete: isPhone ? 'tel' : 'email',
            style: { direction: 'ltr', textAlign: 'left' },
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: '#7B8C8E', letterSpacing: '0.03em' }}>رمز عبور</label>
        <AuthInput
          inputProps={{
            type: showPass ? 'text' : 'password', value: password,
            onChange: e => setPassword(e.target.value),
            placeholder: '••••••••', autoComplete: 'new-password',
            style: { direction: 'ltr', textAlign: 'left' },
          }}
          suffix={
            <button type="button" onClick={() => setShowPass(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#9AA5A6' }}>
              <EyeIcon open={showPass} />
            </button>
          }
        />
        {password && <PasswordStrength pw={password} />}
      </div>
      <AuthInput
        label="تکرار رمز عبور"
        error={pwMismatch ? 'رمزها تطابق ندارند' : undefined}
        suffix={pwMatch ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F8F6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : null}
        inputProps={{
          type: 'password', value: confirmPw,
          onChange: e => setConfirmPw(e.target.value),
          placeholder: '••••••••', autoComplete: 'new-password',
          style: { direction: 'ltr', textAlign: 'left' },
        }}
      />
      <TeknavCAP onChange={setCaptcha} />
      <p style={{ fontSize: 11, color: '#9AA5A6', margin: 0, lineHeight: 1.8 }}>
        با ثبت‌نام،{' '}
        <a href="#" style={{ color: '#C46A4D', textDecoration: 'underline', textUnderlineOffset: '2px' }}>شرایط استفاده</a>
        {' '}و{' '}
        <a href="#" style={{ color: '#C46A4D', textDecoration: 'underline', textUnderlineOffset: '2px' }}>سیاست حریم خصوصی</a>
        {' '}تکناو را می‌پذیرید.
      </p>
      <button type="submit" disabled={loading} className="auth-gold-btn" style={goldBtn(loading)}>
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(15,42,46,0.25)', borderTopColor: '#0F2A2E', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            در حال ثبت‌نام...
          </span>
        ) : 'ایجاد حساب کاربری'}
      </button>
    </form>
  );
}

// ── OAuth buttons ─────────────────────────────────────────────────────────────
function OAuthButtons({ oauthError }) {
  const { startOAuth } = useAuth();
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    api.get('/api/auth/oauth/providers')
      .then(d => setProviders(d?.providers ?? []))
      .catch(() => {});
  }, []);
  if (providers.length === 0 && !oauthError) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      {oauthError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#991B1B' }}>
          {oauthError === 'account_suspended' ? 'این حساب معلق شده است' : 'ورود با این روش ممکن نبود. دوباره تلاش کنید'}
        </div>
      )}
      {providers.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {providers.includes('google') && (
              <button type="button" onClick={() => startOAuth('google')} className="auth-oauth-btn" style={oauthBtnStyle}>
                <GoogleIcon /><span>ادامه با Google</span>
              </button>
            )}
            {providers.includes('github') && (
              <button type="button" onClick={() => startOAuth('github')} className="auth-oauth-btn" style={oauthBtnStyle}>
                <GithubIcon /><span>ادامه با GitHub</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E8E2D8' }} />
            <span style={{ fontSize: 11, color: '#B4BCBE', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>یا با ایمیل</span>
            <div style={{ flex: 1, height: 1, background: '#E8E2D8' }} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Main LoginPage ────────────────────────────────────────────────────────────
function LoginPage() {
  const { navigate } = useNav();
  const toast = useToast();
  const { user, refreshMe } = useAuth();
  const [tab, setTab] = useState('login');
  const greeting = useTimeGreeting();

  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const oauthError = hashParams.get('error') || null;
  const emailVerifyToken = new URLSearchParams(window.location.search).get('verifyEmail');

  useEffect(() => {
    if (!emailVerifyToken || !user) return;
    api.post('/api/auth/email/verify/confirm', { token: emailVerifyToken })
      .then(async () => {
        const freshUser = await refreshMe?.();
        toast('ایمیل شما تایید شد');
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        navigate((freshUser?.role ?? user.role) === 'reader' ? '/' : '/admin');
      })
      .catch(() => toast('تایید ایمیل ناموفق بود یا لینک منقضی شده است', 'error'));
  }, [emailVerifyToken, user]);

  useEffect(() => {
    if (user && !emailVerifyToken) navigate(user.role === 'reader' ? '/' : '/admin');
  }, [user, emailVerifyToken]);

  const handleSuccess = (u) => {
    toast(`خوش آمدید، ${u.name}!`);
    navigate(u.role === 'reader' ? '/' : '/admin');
  };

  return (
    <>
      <AuthStyles />
      <div className="auth-layout">

        {/* ── Form column (right in RTL) ──────────────────────────────── */}
        <div className="auth-form-col">
          {/* Radial vignette overlay */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 55% at 50% 5%, rgba(250,247,240,0) 0%, rgba(250,247,240,0.55) 100%)',
          }} />

          <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

            {/* Mobile logo */}
            <div className="auth-mobile-logo" style={{ justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(145deg, #C8951C, #D49A2A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(200,149,28,0.3)',
              }}>
                <span style={{ color: '#0F2A2E', fontSize: 21, fontWeight: 900 }}>ت</span>
              </div>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#0F2A2E', fontFamily: 'PelakFA,Vazirmatn,sans-serif' }}>تکناو</span>
            </div>

            {/* Heading with vertical accent bar + time-based greeting */}
            <div className="auth-card" style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 3.5, height: 30, borderRadius: 2, flexShrink: 0,
                  background: 'linear-gradient(to bottom, #C46A4D, rgba(200,149,28,0.6))',
                }} />
                <h1 style={{
                  margin: 0, fontFamily: 'PelakFA,Vazirmatn,sans-serif',
                  fontSize: 25, fontWeight: 800, color: '#0F2A2E', lineHeight: 1.25,
                }}>
                  {tab === 'login' ? greeting : 'عضو تکناو شوید'}
                </h1>
              </div>
              <p style={{ margin: '0 0 0 14px', fontSize: 13, color: '#9AA5A6', lineHeight: 1.6 }}>
                {tab === 'login'
                  ? 'با حساب کاربری خود وارد شوید'
                  : 'در چند ثانیه حساب رایگان بسازید'}
              </p>
            </div>

            {/* Pill tab switcher */}
            <div style={{
              display: 'flex', background: '#EDE9E2', borderRadius: 12,
              padding: 4, marginBottom: 24, gap: 3,
            }}>
              {[{ key: 'login', label: 'ورود' }, { key: 'signup', label: 'ثبت‌نام' }].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className="auth-tab-btn" style={{
                  background: tab === t.key ? '#fff' : 'transparent',
                  color: tab === t.key ? '#0F2A2E' : '#9AA5A6',
                  boxShadow: tab === t.key ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>

            {/* OAuth */}
            <OAuthButtons oauthError={tab === 'login' ? oauthError : null} />

            {/* Form */}
            <div className="auth-card">
              {tab === 'login'
                ? <LoginForm onSuccess={handleSuccess} />
                : <SignupForm onSuccess={handleSuccess} />}
            </div>

            {/* Switch prompt */}
            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: '#9AA5A6' }}>
              {tab === 'login' ? (
                <>حساب ندارید؟{' '}<button onClick={() => setTab('signup')} className="auth-switch-link">ثبت‌نام کنید</button></>
              ) : (
                <>قبلاً حساب ساخته‌اید؟{' '}<button onClick={() => setTab('login')} className="auth-switch-link">وارد شوید</button></>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 28, fontSize: 10, color: '#C4C8C9', letterSpacing: '0.06em' }}>
              TEKNAV · نشریه فناوری فارسی
            </div>
          </div>
        </div>

        {/* ── Brand column (left in RTL) ──────────────────────────────── */}
        <BrandPanel />
      </div>
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const goldBtn = (loading) => ({
  width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
  background: loading ? '#E8E2D8' : 'linear-gradient(135deg, #C8951C 0%, #D49A2A 60%, #C8951C 100%)',
  color: loading ? '#B0B8BA' : '#0F2A2E',
  fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
  fontFamily: 'Vazirmatn,sans-serif',
  boxShadow: loading ? 'none' : '0 4px 16px rgba(200,149,28,0.22)',
  transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.2s',
  letterSpacing: '0.02em', marginTop: 4,
});

const cancelBtn = {
  flex: 1, padding: '12px 0', border: '1.5px solid #E4DDD2', borderRadius: 10,
  background: 'transparent', color: '#7B8C8E', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: 'Vazirmatn,sans-serif',
};

const oauthBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  width: '100%', padding: '11px 0', borderRadius: 10,
  border: '1.5px solid #E4DDD2', background: '#fff', cursor: 'pointer',
  fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, fontWeight: 600, color: '#1A2E30',
  transition: 'border-color 0.18s, background 0.18s',
};

export { LoginPage };
