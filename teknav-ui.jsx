// teknav-ui.jsx — Shared UI components (ES module)
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { api, ApiError } from './src/lib/api.js';
import { contentApi } from './src/lib/content-api.js';
import { engagementApi } from './src/lib/engagement-api.js';
import TeknavCAP from './src/lib/TeknavCAP.jsx';

// ── Toast System ────────────────────────────────────────────────────────────
const ToastCtx = createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div style={{ position: 'fixed', bottom: 28, left: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '11px 20px', borderRadius: 8, color: '#fff', fontSize: 14, fontFamily: 'Vazirmatn,sans-serif',
            background: t.type === 'error' ? '#C94C4C' : t.type === 'warning' ? '#D08A22' : '#2F8F6B',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            animation: 'slideUp 0.25s ease', direction: 'rtl',
          }}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx);

// ── Navigation Context ──────────────────────────────────────────────────────
const NavCtx = createContext(null);
function getCurrentPage() {
  const hashPath = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '';
  if (hashPath) {
    window.history.replaceState(null, '', hashPath);
    return hashPath;
  }
  const pathname = window.location.pathname;
  // Strip trailing slash (except root "/") so /article/slug/ resolves same as /article/slug
  const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const path = `${cleanPath}${window.location.search}`;
  return path === '' ? '/' : path;
}
function NavProvider({ children }) {
  const [page, setPage] = useState(getCurrentPage);
  const navigate = useCallback((to) => {
    if (`${window.location.pathname}${window.location.search}` !== to) {
      window.history.pushState(null, '', to);
    }
    setPage(to);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const handler = () => setPage(getCurrentPage());
    window.addEventListener('popstate', handler);
    window.addEventListener('hashchange', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('hashchange', handler);
    };
  }, []);
  return <NavCtx.Provider value={{ page, navigate }}>{children}</NavCtx.Provider>;
}
const useNav = () => useContext(NavCtx);

// ── Auth Context ────────────────────────────────────────────────────────────
// Backend-backed auth: cookie session (HttpOnly tek_sid) + double-submit CSRF
// (tek_csrf, mirrored to X-CSRF-Token by src/lib/api.js). The server is the
// only source of truth — there's no `user` in localStorage anymore.
const AuthCtx = createContext(null);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // On mount, ask the server who we are (cookie may already be valid from a
  // previous tab). 401 just means "not signed in" — not an error.
  const refreshMe = async () => {
    const res = await api.get('/api/auth/me');
    setUser(res?.user ?? null);
    return res?.user ?? null;
  };

  useEffect(() => {
    let cancelled = false;
    api.get('/api/auth/me')
      .then((res) => { if (!cancelled) setUser(res?.user ?? null); })
      .catch((e) => { if (!(e instanceof ApiError && e.status === 401)) console.error('[auth/me]', e); })
      .finally(() => { if (!cancelled) setBootstrapping(false); });
    return () => { cancelled = true; };
  }, []);

  const login = async (identifier, password, captchaId, userSolution) => {
    const res = await api.post('/api/auth/login', { identifier, password, captchaId, userSolution });
    if (res?.user) setUser(res.user);
    return res?.twoFactorRequired ? res : (res?.user ?? null);
  };

  const verifyTwoFactor = async (ticket, code) => {
    const res = await api.post('/api/auth/2fa/verify', { ticket, code });
    if (res?.user) setUser(res.user);
    return res?.user ?? null;
  };

  const signup = async ({ name, username, email, phone, password, captchaId, userSolution }) => {
    const res = await api.post('/api/auth/signup', { name, username, email, phone, password, captchaId, userSolution });
    if (res?.user) setUser(res.user);
    return res?.user ?? null;
  };

  const startOAuth = (provider) => {
    window.location.href = `/api/auth/oauth/${provider}/start`;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout', {}); } catch (e) { console.warn('[auth/logout]', e); }
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, verifyTwoFactor, signup, startOAuth, logout, refreshMe, bootstrapping }}>{children}</AuthCtx.Provider>;
}
const useAuth = () => useContext(AuthCtx);

// ── Badges ──────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  'تحلیل عمیق': { bg: '#0F6B73', text: '#fff' },
  'راهنمای فنی': { bg: '#D49A2A', text: '#fff' },
  'داده‌نما': { bg: '#C76D4A', text: '#fff' },
  'پژوهش': { bg: '#2F8F6B', text: '#fff' },
  'راستی‌آزمایی‌شده': { bg: '#263238', text: '#fff' },
  'خبر فوری': { bg: '#C94C4C', text: '#fff' },
  'خبر تحلیلی': { bg: '#5F6B6D', text: '#fff' },
  'پرونده': { bg: '#20343A', text: '#FAF7F0' },
  'default': { bg: '#E4DDD2', text: '#263238' },
};
function CategoryBadge({ name, color, small }) {
  return (
    <span style={{
      display: 'inline-block', padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 4, fontSize: small ? 11 : 12, fontWeight: 600,
      background: color ? color + '18' : '#0F6B7318', color: color || '#0F6B73',
      border: `1px solid ${color || '#0F6B73'}30`,
    }}>{name}</span>
  );
}
function TypeBadge({ type, small }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.default;
  return (
    <span style={{
      display: 'inline-block', padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 3, fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: '0.03em',
      background: c.bg, color: c.text,
    }}>{type}</span>
  );
}
const STATUS_COLORS = {
  'منتشرشده': '#2F8F6B', 'پیش‌نویس': '#5F6B6D', 'در انتظار بررسی': '#D49A2A',
  'نیازمند اصلاح': '#C94C4C', 'زمان‌بندی‌شده': '#0F6B73',
};
function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#5F6B6D';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: color + '15', color, border: `1px solid ${color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status}
    </span>
  );
}
const ROLE_COLORS = { admin: '#C76D4A', editor: '#0F6B73', writer: '#D49A2A', reviewer: '#2F8F6B', reader: '#5F6B6D' };
const ROLE_NAMES = { admin: 'مدیر کل', editor: 'سردبیر', writer: 'نویسنده', reviewer: 'بازبین', reader: 'خواننده' };
function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#5F6B6D';
  return (
    <span style={{ padding: '2px 9px', borderRadius: 3, fontSize: 11, fontWeight: 700, background: color + '18', color }}>{ROLE_NAMES[role] || role}</span>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'خانه', path: '/' },
  { label: 'هوش مصنوعی', path: '/category/ai' },
  { label: 'علم داده', path: '/category/data' },
  { label: 'استارتاپ', path: '/category/startup' },
  { label: 'امنیت', path: '/category/security' },
  { label: 'سخت‌افزار', path: '/category/hardware' },
  { label: 'نرم‌افزار', path: '/category/software' },
  { label: 'آینده فناوری', path: '/category/future' },
  { label: 'نویسندگان', path: '/authors' },
];

function Header() {
  const { navigate, page } = useNav();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 100);
  }, [searchOpen]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQ.trim()) { navigate('/search?q=' + encodeURIComponent(searchQ)); setSearchOpen(false); setSearchQ(''); }
  };

  return (
    <>
      <header role="banner" style={{
        position: 'fixed', top: 0, right: 0, left: 0, zIndex: 100, direction: 'rtl',
        background: scrolled ? 'rgba(250,247,240,0.95)' : 'rgba(250,247,240,0.85)',
        backdropFilter: 'blur(12px)', borderBottom: scrolled ? '1px solid #E4DDD2' : '1px solid transparent',
        transition: 'all 0.3s',
      }}>
        <div className="site-header-inner" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 64, gap: 32 }}>
          {/* Logo */}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', lineHeight: 1 }} aria-label="خانه تکناو">
            <span style={{ fontSize: 22, fontWeight: 900, color: '#0F6B73', fontFamily: 'Vazirmatn,sans-serif', letterSpacing: '-0.02em' }}>تکناو</span>
            <span style={{ fontSize: 9, color: '#5F6B6D', letterSpacing: '0.15em', fontFamily: 'sans-serif' }}>TEKNAV</span>
          </button>

          {/* Nav */}
          <nav role="navigation" style={{ display: 'flex', gap: 0, flex: 1, overflowX: 'auto' }} className="desktop-nav" aria-label="منوی اصلی">
            {NAV_ITEMS.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px',
                fontSize: 13, fontFamily: 'Vazirmatn,sans-serif', whiteSpace: 'nowrap',
                color: page === item.path ? '#0F6B73' : '#263238',
                fontWeight: page === item.path ? 700 : 400,
                borderBottom: page === item.path ? '2px solid #0F6B73' : '2px solid transparent',
                transition: 'all 0.15s',
              }} aria-current={page === item.path ? 'page' : undefined}>{item.label}</button>
            ))}
          </nav>

          {/* Actions */}
          <div className="site-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setSearchOpen(s => !s)} style={iconBtnStyle} aria-label="جستجو در تکناو" aria-expanded={searchOpen}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#263238" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            {user ? (
              <div className="site-auth-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <NotificationBell />
                {user.role !== 'reader' && (
                  <button onClick={() => navigate('/admin')} style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }} aria-label="پنل مدیریت">{ROLE_NAMES[user.role] || user.role}</button>
                )}
                {user.username && (
                  <button onClick={() => navigate('/profile/@' + user.username)} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238' }} aria-label={`پروفایل @${user.username}`}>@{user.username}</button>
                )}
                {user.role === 'reader' && !user.username && (
                  <span style={{ fontSize: 13, color: '#5F6B6D', fontWeight: 600 }}>{user.name}</span>
                )}
                <button onClick={() => { logout(); navigate('/'); }} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238' }} aria-label="خروج از حساب">خروج</button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')} style={{ ...pillBtn, background: '#C46A4D', color: '#fff' }} aria-label="ورود یا ثبت‌نام در تکناو">ورود / ثبت‌نام</button>
            )}
            <button onClick={() => setMobileOpen(o => !o)} style={{ ...iconBtnStyle, display: 'none' }} className="mobile-menu-btn" aria-label="باز کردن منوی موبایل" aria-expanded={mobileOpen}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#263238" strokeWidth="2" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="site-search-strip" style={{ borderTop: '1px solid #E4DDD2', padding: '12px 24px', background: '#FAF7F0' }}>
            <form className="site-search-form" role="search" onSubmit={handleSearch} style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 8 }}>
              <input ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="جستجو در مقاله‌ها، نویسندگان و دسته‌بندی‌ها..."
                style={{ flex: 1, ...inputStyle, fontSize: 14 }} dir="rtl" aria-label="عبارت جستجو" />
              <button type="submit" style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }} aria-label="اجرای جستجو">جستجو</button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, direction: 'rtl' }}>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div className="mobile-drawer-panel" style={{ position: 'absolute', top: 0, right: 0, width: 280, height: '100%', background: '#FAF7F0', padding: 24, overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0F6B73' }}>تکناو</span>
              <button onClick={() => setMobileOpen(false)} style={iconBtnStyle}>✕</button>
            </div>
            {NAV_ITEMS.map(item => (
              <button key={item.path} onClick={() => { navigate(item.path); setMobileOpen(false); }} style={{
                display: 'block', width: '100%', textAlign: 'right', background: 'none', border: 'none',
                padding: '12px 0', fontSize: 15, fontFamily: 'Vazirmatn,sans-serif', cursor: 'pointer',
                color: page === item.path ? '#0F6B73' : '#263238', fontWeight: page === item.path ? 700 : 400,
                borderBottom: '1px solid #E4DDD2',
              }}>{item.label}</button>
            ))}
            {user ? (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {user.username && (
                  <button onClick={() => { navigate('/profile/@' + user.username); setMobileOpen(false); }} style={{ ...pillBtn, width: '100%', justifyContent: 'center' }}>@{user.username}</button>
                )}
                {user.role !== 'reader' && (
                  <button onClick={() => { navigate('/admin'); setMobileOpen(false); }} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', width: '100%', justifyContent: 'center' }}>پنل مدیریت</button>
                )}
                <button onClick={() => { logout(); navigate('/'); setMobileOpen(false); }} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', width: '100%', justifyContent: 'center' }}>خروج</button>
              </div>
            ) : (
              <button onClick={() => { navigate('/login'); setMobileOpen(false); }} style={{ ...pillBtn, background: '#C46A4D', color: '#fff', width: '100%', justifyContent: 'center', marginTop: 20 }}>ورود / ثبت‌نام</button>
            )}
          </div>
        </div>
      )}
      <style>{`
        .desktop-nav { display: flex !important; }
        .mobile-menu-btn { display: none !important; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #FAF7F0; }
        ::-webkit-scrollbar-thumb { background: #E4DDD2; border-radius: 3px; }
      `}</style>
    </>
  );
}

function NotificationBell() {
  const { navigate } = useNav();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    engagementApi.listNotifications({ limit: 20 })
      .then(res => {
        if (!cancelled) {
          setItems(res?.items ?? []);
          setUnread(res?.unread ?? 0);
        }
      })
      .catch(() => {});
    const es = new EventSource('/api/auth/notifications/stream', { withCredentials: true });
    es.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data);
      setItems(list => [notification, ...list].slice(0, 20));
      setUnread(n => n + 1);
    });
    es.onerror = () => {};
    return () => { cancelled = true; es.close(); };
  }, []);

  const openNotification = async (notification) => {
    if (!notification.read) {
      engagementApi.markNotificationRead(notification.id).catch(() => {});
      setUnread(n => Math.max(0, n - 1));
      setItems(list => list.map(item => item.id === notification.id ? { ...item, read: true } : item));
    }
    const slug = notification.payload?.articleSlug;
    if (slug) navigate('/article/' + slug);
    setOpen(false);
  };

  const markAll = async () => {
    await engagementApi.markNotificationsRead().catch(() => {});
    setUnread(0);
    setItems(list => list.map(item => ({ ...item, read: true })));
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ ...iconBtnStyle, position: 'relative' }} aria-label="اعلان‌ها">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#263238" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, left: -4, minWidth: 17, height: 17, borderRadius: 9, background: '#C94C4C', color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {unread > 9 ? '9+' : unread.toLocaleString('fa-IR')}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 42, left: 0, width: 320, maxWidth: '80vw', background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, boxShadow: '0 16px 44px rgba(0,0,0,0.14)', zIndex: 220, direction: 'rtl', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #E4DDD2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13, color: '#263238' }}>اعلان‌ها</strong>
            <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#0F6B73', cursor: 'pointer', fontSize: 11 }}>خواندن همه</button>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: '#5F6B6D' }}>اعلانی وجود ندارد.</div>
          ) : items.map(item => (
            <button key={item.id} onClick={() => openNotification(item)} style={{ display: 'block', width: '100%', border: 'none', borderBottom: '1px solid #F4EFE6', background: item.read ? '#fff' : '#F4EFE6', textAlign: 'right', padding: 12, cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
              <div style={{ fontSize: 12, fontWeight: item.read ? 600 : 900, color: '#263238', lineHeight: 1.6 }}>{notificationText(item)}</div>
              <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>{item.payload?.articleTitle ?? ''}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function notificationText(item) {
  if (item.type === 'comment_reply') return `${item.payload?.actorName ?? 'کاربر'} به نظر شما پاسخ داد`;
  if (item.type === 'comment') return `${item.payload?.actorName ?? 'کاربر'} برای مقاله شما نظر گذاشت`;
  if (item.type === 'new_article') return `مقاله تازه از ${item.payload?.actorName ?? 'نویسنده'}`;
  return 'اعلان جدید';
}

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const { navigate } = useNav();
  return (
    <footer role="contentinfo" style={{ background: '#ebe3d2', color: '#4A5A5C', direction: 'rtl', padding: '56px 24px 28px', marginTop: 80, position: 'relative', overflow: 'hidden' }}>
      {/* Decorative top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent 0%, #0F6B73 25%, #D49A2A 50%, #C46A4D 75%, transparent 100%)' }} />
      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 40, marginBottom: 40 }}>
          <section aria-label="درباره تکناو">
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0F2A2E', marginBottom: 6, fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>تکناو</div>
            <div style={{ fontSize: 11, color: '#C46A4D', letterSpacing: '0.18em', marginBottom: 14, fontWeight: 700 }}>TEKNAV</div>
            <p style={{ fontSize: 13, lineHeight: 1.9, color: '#5F6B6D' }}>روایت عمیق فناوری. تحلیل‌های علمی و تخصصی از دنیای فناوری برای متخصصان ایرانی.</p>
          </section>
          <nav aria-label="لینک‌های دسته‌بندی">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F2A2E', marginBottom: 16, fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>دسته‌بندی‌ها</div>
            {['هوش مصنوعی', 'علم داده', 'امنیت سایبری', 'سخت‌افزار', 'نرم‌افزار'].map(c => (
              <div key={c} style={{ fontSize: 13, marginBottom: 9, cursor: 'pointer', color: '#5F6B6D', transition: 'color 0.15s, transform 0.15s', transformOrigin: 'right' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0F6B73'; e.currentTarget.style.transform = 'translateX(-4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#5F6B6D'; e.currentTarget.style.transform = 'translateX(0)'; }}>{c}</div>
            ))}
          </nav>
          <nav aria-label="لینک‌های راهنما">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F2A2E', marginBottom: 16, fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>تکناو</div>
            {['درباره ما', 'تیم نویسندگان', 'قوانین حریم خصوصی', 'تماس با ما'].map(l => (
              <div key={l} style={{ fontSize: 13, marginBottom: 9, cursor: 'pointer', color: '#5F6B6D', transition: 'color 0.15s, transform 0.15s', transformOrigin: 'right' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0F6B73'; e.currentTarget.style.transform = 'translateX(-4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#5F6B6D'; e.currentTarget.style.transform = 'translateX(0)'; }}>{l}</div>
            ))}
          </nav>
          <section aria-label="ارتباط با ما">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F2A2E', marginBottom: 16, fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>ارتباط با ما</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {['توییتر', 'لینکدین', 'تلگرام'].map(s => (
                <button key={s} style={{ background: 'rgba(15,107,115,0.08)', border: '1px solid rgba(15,107,115,0.25)', color: '#0F6B73', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Vazirmatn,sans-serif', transition: 'all 0.18s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0F6B73'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,107,115,0.08)'; e.currentTarget.style.color = '#0F6B73'; e.currentTarget.style.transform = 'translateY(0)'; }}>{s}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#C46A4D', fontWeight: 600 }}>info@teknav.ir</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(180,100,40,0.1)', border: '1px solid rgba(180,100,40,0.22)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#9B5C1A' }}>🌊 حامی خلیج فارس</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(180,100,40,0.1)', border: '1px solid rgba(180,100,40,0.22)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#9B5C1A' }}>🌐 حامی اینترنت آزاد برای عموم</span>
            </div>
          </section>
        </div>
        <div style={{ borderTop: '1px solid rgba(15,42,46,0.12)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#5F6B6D' }}>© ۱۴۰۵ تکناو — تمام حقوق محفوظ است</span>
          <span style={{ fontSize: 12, color: '#5F6B6D', letterSpacing: '0.04em' }}>
            Designed By <span style={{ color: '#0F6B73', fontWeight: 700, letterSpacing: '0.08em' }}>Coaxys</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

// ── Newsletter Form ─────────────────────────────────────────────────────────
function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [captcha, setCaptcha] = useState({ captchaId: '', userSolution: '' });
  const toast = useToast();

  const submit = async (e) => {
    e.preventDefault();
    if (!email.includes('@') || !email.includes('.')) { toast('لطفاً یک ایمیل معتبر وارد کنید', 'error'); return; }
    if (!captcha.captchaId || !captcha.userSolution.trim()) { toast('لطفاً کد امنیتی را وارد کنید', 'error'); return; }
    try {
      const res = await contentApi.subscribeNewsletter(email, captcha.captchaId, captcha.userSolution);
      setState('done');
      toast(res?.alreadySubscribed ? 'این ایمیل قبلاً ثبت شده است' : 'با موفقیت عضو خبرنامه شدید!', res?.alreadySubscribed ? 'warning' : 'success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) toast('تعداد درخواست‌ها از حد مجاز گذشت؛ کمی بعد دوباره تلاش کنید', 'warning');
      else if (err instanceof ApiError && err.status === 400) toast('کد امنیتی نامعتبر است', 'error');
      else toast('خطا در ثبت عضویت خبرنامه', 'error');
    }
  };

  if (state === 'done') return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#2F8F6B' }}>عضویت شما ثبت شد!</div>
      <div style={{ fontSize: 13, color: '#5F6B6D', marginTop: 4 }}>جدیدترین مقاله‌های تکناو را در ایمیل دریافت خواهید کرد.</div>
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 460, margin: '0 auto' }}>
      <input value={email} onChange={e => setEmail(e.target.value)} type="email"
        placeholder="آدرس ایمیل شما"
        style={{ flex: 1, minWidth: 200, ...inputStyle }} dir="rtl" />
      <TeknavCAP onChange={setCaptcha} />
      <button type="submit" style={{ ...pillBtn, background: '#C46A4D', color: '#fff', padding: '10px 24px' }}>عضویت در خبرنامه</button>
    </form>
  );
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────
function SkeletonLoader({ lines = 3, height = 16 }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ height, borderRadius: 6, background: 'linear-gradient(90deg,#E4DDD2 0%,#F4EFE6 50%,#E4DDD2 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: 10, width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

// ── Confirm Modal ───────────────────────────────────────────────────────────
function ConfirmModal({ msg, onConfirm, onCancel }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', background: '#FAF7F0', borderRadius: 12, padding: 32, maxWidth: 380, width: '90%', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#263238' }}>تأیید عملیات</div>
        <div style={{ fontSize: 13, color: '#5F6B6D', lineHeight: 1.7, marginBottom: 24 }}>{msg}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238' }}>انصراف</button>
          <button onClick={onConfirm} style={{ ...pillBtn, background: '#C94C4C', color: '#fff' }}>تأیید و حذف</button>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ title = 'نتیجه‌ای یافت نشد', subtitle = 'با فیلترهای دیگر امتحان کنید' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: '#5F6B6D' }}>
      <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>◎</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#263238' }}>{title}</div>
      <div style={{ fontSize: 13 }}>{subtitle}</div>
    </div>
  );
}

// ── Reading Progress ────────────────────────────────────────────────────────
function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const h = () => {
      const el = document.documentElement;
      const scroll = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? (scroll / total) * 100 : 0);
    };
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <div style={{ position: 'fixed', top: 64, right: 0, left: 0, height: 3, zIndex: 99, background: '#E4DDD2' }}>
      <div style={{ height: '100%', width: pct + '%', background: '#0F6B73', transition: 'width 0.1s linear' }} />
    </div>
  );
}

// ── Author Avatar ───────────────────────────────────────────────────────────
function AuthorAvatar({ author, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: author.color || '#0F6B73',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.32, fontWeight: 700, flexShrink: 0,
    }}>{author.initials || author.name.slice(0, 2)}</div>
  );
}

// ── Shared styles ───────────────────────────────────────────────────────────
const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, borderRadius: 8, transition: 'background 0.15s',
};
const pillBtn = {
  border: 'none', cursor: 'pointer', padding: '8px 18px', borderRadius: 8,
  fontSize: 13, fontFamily: 'Vazirmatn,sans-serif', fontWeight: 600,
  transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const inputStyle = {
  border: '1px solid #E4DDD2', borderRadius: 8, padding: '9px 14px',
  fontSize: 13, fontFamily: 'Vazirmatn,sans-serif', background: '#fff',
  color: '#263238', outline: 'none', width: '100%',
};

// ── Streak Widget ───────────────────────────────────────────────────────────
function StreakWidget() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => {
    if (user) engagementApi.getStreaks().then(setData).catch(() => {});
  }, [user]);
  if (!user || !data || data.streak === 0) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #FF9D6C 0%, #C46A4D 100%)',
      padding: '8px 14px', borderRadius: 12, color: '#fff', fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 15px rgba(196,106,77,0.3)',
      animation: 'float-y 3s ease-in-out infinite',
    }}>
      <span style={{ fontSize: 18 }}>🔥</span>
      <div>
        <div style={{ fontWeight: 800 }}>{data.streak.toLocaleString('fa-IR')} روز مطالعه متوالی!</div>
        <div style={{ fontSize: 10, opacity: 0.9 }}>به یادگیری ادامه دهید</div>
      </div>
    </div>
  );
}

// ── Continue Reading Bar ───────────────────────────────────────────────────
function ContinueReadingBar() {
  const { user } = useAuth();
  const { navigate } = useNav();
  const [data, setData] = useState(null);
  useEffect(() => {
    if (user) engagementApi.getStreaks().then(setData).catch(() => {});
  }, [user]);
  if (!user || !data || !data.continueReading?.length) return null;
  return (
    <div style={{ background: '#263238', color: '#fff', padding: '12px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, overflowX: 'auto' }}>
        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: '#FF9D6C' }}>ادامه مطالعه:</span>
        {data.continueReading.map(a => (
          <button key={a.id} onClick={() => navigate('/article/' + a.slug)} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'right', minWidth: 140,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{a.title}</div>
            <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
              <div style={{ width: (a.progress * 100) + '%', height: '100%', background: '#0F6B73' }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Reading List Modal ──────────────────────────────────────────────────────
function ReadingListModal({ articleId, onDone }) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    engagementApi.listReadingLists()
      .then(res => setLists(res.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (listId) => {
    try {
      await engagementApi.addToReadingList(listId, articleId);
      toast('به لیست اضافه شد');
      onDone();
    } catch (e) {
      toast('در این لیست موجود است', 'warning');
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const res = await engagementApi.createReadingList(newListName);
      setNewListName('');
      add(res.list.id);
    } catch {
      toast('خطا در ایجاد لیست', 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onDone} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: '#FAF7F0', borderRadius: 16, padding: 24, maxWidth: 400, width: '90%', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#263238' }}>ذخیره در لیست مطالعه</h3>
          <button onClick={onDone} style={iconBtnStyle}>✕</button>
        </div>
        
        {loading ? <SkeletonLoader lines={3} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
            {lists.map(list => (
              <button key={list.id} onClick={() => add(list.id)} style={{
                width: '100%', padding: '12px 16px', borderRadius: 10, background: '#fff', border: '1px solid #E4DDD2',
                textAlign: 'right', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontFamily: 'Vazirmatn,sans-serif', transition: 'all 0.15s',
              }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#0F6B73'; e.currentTarget.style.background = '#0F6B7308'; }}
                 onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4DDD2'; e.currentTarget.style.background = '#fff'; }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#263238' }}>{list.name}</span>
                <span style={{ fontSize: 11, color: '#5F6B6D' }}>{list._count?.items ?? 0} مورد</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={create} style={{ borderTop: '1px solid #E4DDD2', paddingTop: 20, display: 'flex', gap: 8 }}>
          <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="نام لیست جدید..." style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>ایجاد</button>
        </form>
      </div>
    </div>
  );
}

// ── Push Notification Prompt ────────────────────────────────────────────────
import { pushApi } from './src/lib/engagement-api.js';

function PushNotificationPrompt({ user }) {
  const [visible, setVisible] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (
      user &&
      'PushManager' in window &&
      'serviceWorker' in navigator &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default' &&
      !localStorage.getItem('push_prompt_dismissed')
    ) {
      setVisible(true);
    }
  }, [user]);

  if (!visible) return null;

  const handleEnable = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        await pushApi.subscribe();
        toast('اعلان‌های مرورگر فعال شد');
      }
    } catch {
      // ignore — user may have denied or push not configured
    }
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem('push_prompt_dismissed', '1');
    setVisible(false);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 160, right: 24, zIndex: 490,
      background: '#1A2E30', border: '1px solid #2A4045', borderRadius: 16,
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 12px 40px rgba(0,0,0,0.22)', animation: 'slideUp 0.3s ease',
      direction: 'rtl', maxWidth: 320,
    }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FAF7F0', marginBottom: 3 }}>اعلان‌های مرورگر</div>
        <div style={{ fontSize: 11, color: '#8AA5A8' }}>مقالات جدید را از دست ندهید</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={dismiss} style={{ ...pillBtn, background: 'transparent', color: '#8AA5A8', border: '1px solid #2A4045', padding: '5px 10px', fontSize: 11 }}>بعداً</button>
        <button onClick={handleEnable} style={{ ...pillBtn, background: '#C46A4D', color: '#fff', padding: '5px 12px', fontSize: 11 }}>فعال‌سازی</button>
      </div>
    </div>
  );
}

// ── Install Prompt ──────────────────────────────────────────────────────────
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 24, zIndex: 500,
      background: '#fff', border: '1px solid #E4DDD2', borderRadius: 16,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)', animation: 'slideUp 0.3s ease',
      direction: 'rtl',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#263238' }}>نصب اپلیکیشن تکناو</div>
        <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>دسترسی سریع‌تر و آفلاین به مقالات</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setVisible(false)} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', padding: '6px 12px', fontSize: 12 }}>بعداً</button>
        <button onClick={install} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', padding: '6px 16px', fontSize: 12 }}>نصب</button>
      </div>
    </div>
  );
}

export {
  ToastProvider, useToast, NavProvider, useNav, AuthProvider, useAuth,
  CategoryBadge, TypeBadge, StatusBadge, RoleBadge, AuthorAvatar,
  Header, Footer, NewsletterForm, SkeletonLoader, ConfirmModal, EmptyState, ReadingProgress,
  StreakWidget, ContinueReadingBar, ReadingListModal, InstallPrompt, PushNotificationPrompt,
  iconBtnStyle, pillBtn, inputStyle,
};

