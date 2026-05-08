// User profile page — /profile/@username
// Terracotta / warm-orange / unique-green palette; no teal.

import { useState, useEffect, useRef } from 'react';
import { useNav, useAuth, useToast, EmptyState, pillBtn, inputStyle } from './teknav-ui.jsx';
import { api } from './src/lib/api.js';
import { engagementApi, pushApi, notificationPreferencesApi } from './src/lib/engagement-api.js';
import { TeknavData } from './teknav-data.js';

// ── Theme ────────────────────────────────────────────────────────────────────
const P = {
  terracotta:  '#C45C3D',
  orange:      '#E07A3A',
  green:       '#3A7D5E',
  greenLight:  '#E8F4EF',
  ink:         '#263238',
  muted:       '#5F6B6D',
  cream:       '#FAF7F0',
  panel:       '#F4EFE6',
  line:        '#E4DDD2',
  white:       '#fff',
};

const ROLE_LABELS = {
  admin:    { label: 'ادمین',    bg: 'rgba(196,92,61,0.10)', color: '#C45C3D', border: 'rgba(196,92,61,0.22)' },
  editor:   { label: 'سردبیر',   bg: 'rgba(58,125,94,0.10)', color: '#2F8F6B', border: 'rgba(58,125,94,0.22)' },
  writer:   { label: 'نویسنده',  bg: 'rgba(212,154,42,0.10)', color: '#A87A10', border: 'rgba(212,154,42,0.22)' },
  reviewer: { label: 'بازبین',   bg: 'rgba(100,120,200,0.10)', color: '#5566AA', border: 'rgba(100,120,200,0.22)' },
  reader:   { label: 'خواننده',  bg: 'rgba(95,107,109,0.08)', color: '#5F6B6D', border: 'rgba(95,107,109,0.18)' },
};

function RolePill({ role }) {
  const r = ROLE_LABELS[role] ?? ROLE_LABELS.reader;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 12px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      background: r.bg, color: r.color, border: `1px solid ${r.border}`,
    }}>{r.label}</span>
  );
}

// ── Avatar with upload overlay ───────────────────────────────────────────────
function AvatarUpload({ user, editable, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [webp, setWebp] = useState(true);
  const [preview, setPreview] = useState(user.avatarUrl ?? null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.'); return; }
    setBusy(true);
    try {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1];
      const data = await api.post('/api/auth/avatar', { file: base64, mimeType: file.type, webp });
      setPreview(data.url);
      onUploaded?.(data.url);
    } catch {
      alert('آپلود آواتار ناموفق بود. دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  const initials = user.name ? user.name.slice(0, 2) : '؟';
  const avatarStyle = {
    width: 110, height: 110, borderRadius: '50%',
    border: `3px solid rgba(196,92,61,0.35)`,
    boxShadow: '0 4px 20px rgba(196,92,61,0.15)',
    objectFit: 'cover', display: 'block',
  };

  return (
    <div style={{ position: 'relative', width: 110 }}>
      {preview
        ? <img src={preview} alt={user.name} style={avatarStyle} />
        : (
          <div style={{ ...avatarStyle, background: P.terracotta, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 900, color: '#fff' }}>
            {initials}
          </div>
        )
      }
      {editable && (
        <>
          <button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '0 0 55px 55px',
              fontSize: 11, padding: '6px 0', cursor: 'pointer',
            }}
          >{busy ? '…' : 'تغییر'}</button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: P.muted, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={webp} onChange={e => setWebp(e.target.checked)} style={{ accentColor: P.terracotta }} />
            ذخیره WebP
          </label>
        </>
      )}
    </div>
  );
}

// ── Inline edit field ────────────────────────────────────────────────────────
function EditField({ label, value, onChange, multiline, placeholder, maxLength }) {
  const style = {
    ...inputStyle,
    fontSize: 14, padding: '8px 12px', marginTop: 4, resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 80 : undefined,
  };
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: P.muted, marginBottom: 4 }}>{label}</div>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} style={style} dir="rtl" placeholder={placeholder} maxLength={maxLength} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} style={style} dir="auto" placeholder={placeholder} maxLength={maxLength} />
      }
    </label>
  );
}

// ── Article mini-card ────────────────────────────────────────────────────────
function ArticleMiniCard({ article, onClick }) {
  const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('fa-IR') : '';
  return (
    <div
      onClick={onClick}
      style={{
        background: P.white, border: `1px solid ${P.line}`, borderRadius: 12, padding: '16px 20px',
        cursor: 'pointer', direction: 'rtl', transition: 'all 0.2s',
        borderRight: `4px solid ${P.terracotta}`,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, marginBottom: 6, lineHeight: 1.5 }}>{article.title}</div>
      {article.summary && <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.7, marginBottom: 10 }}>{article.summary.slice(0, 140)}{article.summary.length > 140 ? '…' : ''}</div>}
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: P.muted }}>
        {date && <span>{date}</span>}
        <span>👁 {article.views ?? 0}</span>
        <span>♥ {article.reactions ?? 0}</span>
      </div>
    </div>
  );
}

// ── Profile settings modal ───────────────────────────────────────────────────
function ProfileSettingsModal({ user, account, onClose, onSaved }) {
  const toast = useToast();
  const { refreshMe } = useAuth();
  const [form, setForm] = useState({ name: user.name ?? '', username: user.username ?? '', bio: user.bio ?? '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', password: '', confirm: '' });
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [error, setError] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBlocked, setPushBlocked] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const canEditUsername = user?.role !== 'reader';

  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setPushBlocked(true);
      return;
    }
    pushApi.isSubscribed().then(setPushEnabled).catch(() => {});
  }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setPasswordField = (k, v) => setPasswordForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setError('');
    try {
      const username = form.username.trim().toLowerCase().replace(/^@/, '');
      if (canEditUsername && !/^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/.test(username)) {
        setError('نام کاربری باید ۳ تا ۳۰ کاراکتر لاتین، عدد، نقطه یا زیرخط باشد.');
        return;
      }
      if (passwordForm.password || passwordForm.confirm || passwordForm.currentPassword) {
        if (passwordForm.password.length < 8) {
          setError('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
          return;
        }
        if (passwordForm.password !== passwordForm.confirm) {
          setError('تکرار رمز عبور جدید تطابق ندارد.');
          return;
        }
      }
      const data = await api.put('/api/auth/profile', {
        name: form.name || undefined,
        ...(canEditUsername ? { username } : {}),
        bio: form.bio || undefined,
        ...(passwordForm.password ? { currentPassword: passwordForm.currentPassword, password: passwordForm.password } : {}),
      });
      onSaved?.(data.user);
      await refreshMe?.();
      onClose();
    } catch (e) {
      const code = e.body?.error;
      setError(code === 'username_taken'
        ? 'این نام کاربری قبلاً گرفته شده است.'
        : code === 'current_password_required'
        ? 'برای تغییر رمز عبور، رمز فعلی را وارد کنید.'
        : code === 'current_password_invalid'
        ? 'رمز فعلی درست نیست.'
        : code === 'username_change_forbidden'
        ? 'تغییر نام کاربری برای این حساب مجاز نیست.'
        : 'ذخیره ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const requestEmailVerification = async () => {
    setVerifyBusy(true);
    try {
      const res = await api.post('/api/auth/email/verify/request', {});
      toast(res?.alreadyVerified ? 'ایمیل قبلاً تایید شده است' : 'لینک تایید ایمیل ارسال شد');
      await refreshMe?.();
    } catch {
      toast('ارسال لینک تایید ایمیل ناموفق بود', 'error');
    } finally {
      setVerifyBusy(false);
    }
  };

  const sendOtp = async () => {
    setVerifyBusy(true);
    try {
      await api.post('/api/auth/otp/send', { phone });
      toast('کد تایید پیامک شد');
    } catch (e) {
      toast(e.body?.error === 'sms_not_configured' ? 'درگاه پیامک روی سرور تنظیم نشده است' : 'ارسال کد تایید ناموفق بود', 'error');
    } finally {
      setVerifyBusy(false);
    }
  };

  const verifyOtp = async () => {
    setVerifyBusy(true);
    try {
      await api.post('/api/auth/otp/verify', { phone, code: otp });
      await refreshMe?.();
      toast('شماره موبایل تایید شد');
    } catch {
      toast('کد تایید معتبر نیست', 'error');
    } finally {
      setVerifyBusy(false);
    }
  };

  const toggleTwoFactor = async () => {
    setVerifyBusy(true);
    try {
      const next = !account?.twoFactorEnabled;
      const res = await api.put('/api/auth/2fa', { enabled: next });
      await refreshMe?.();
      onSaved?.(res.user);
      toast(next ? 'ورود دومرحله‌ای فعال شد' : 'ورود دومرحله‌ای غیرفعال شد');
    } catch (e) {
      toast(e.body?.error === 'phone_required' ? 'برای فعال‌سازی، ابتدا موبایل را تایید کنید' : 'تغییر ورود دومرحله‌ای ناموفق بود', 'error');
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'relative', background: P.cream, borderRadius: 16, padding: 32,
        maxWidth: 440, width: '90%', maxHeight: '88vh', overflowY: 'auto', direction: 'rtl', boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
      }}>
        <h3 style={{ margin: '0 0 24px', color: P.ink, fontSize: 18 }}>ویرایش پروفایل</h3>
        <EditField label="نام نمایشی" value={form.name} onChange={v => set('name', v)} placeholder="نام کامل شما" maxLength={80} />
        {canEditUsername ? (
          <EditField label="نام کاربری (@ آدرس)" value={form.username} onChange={v => set('username', v.toLowerCase())} placeholder="coaxys" maxLength={30} />
        ) : (
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 14, background: P.panel, border: `1px solid ${P.line}`, borderRadius: 10, padding: '8px 10px' }}>
            نام کاربری برای کاربران عادی قابل تغییر نیست.
          </div>
        )}
        <EditField label="بیوگرافی" value={form.bio} onChange={v => set('bio', v)} multiline placeholder="چند جمله درباره خودتان…" maxLength={280} />
        <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, marginBottom: 10 }}>تغییر رمز عبور</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input value={passwordForm.currentPassword} onChange={e => setPasswordField('currentPassword', e.target.value)} type="password" placeholder="رمز فعلی" style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} autoComplete="current-password" />
            <input value={passwordForm.password} onChange={e => setPasswordField('password', e.target.value)} type="password" placeholder="رمز جدید" style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} autoComplete="new-password" />
            <input value={passwordForm.confirm} onChange={e => setPasswordField('confirm', e.target.value)} type="password" placeholder="تکرار رمز جدید" style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} autoComplete="new-password" />
          </div>
        </div>
        <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, marginBottom: 10 }}>تایید حساب</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: P.muted }}>ایمیل: {account?.emailVerified ? 'تایید شده' : 'تایید نشده'}</span>
              {!account?.emailVerified && <button onClick={requestEmailVerification} disabled={verifyBusy} style={{ ...pillBtn, background: '#fff', color: P.terracotta, border: `1px solid ${P.line}`, fontSize: 12 }}>ارسال لینک تایید</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="شماره موبایل" style={inputStyle} dir="ltr" />
              <button onClick={sendOtp} disabled={verifyBusy || !phone} style={{ ...pillBtn, background: '#fff', color: P.green, border: `1px solid ${P.line}`, fontSize: 12 }}>ارسال کد</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="کد تایید" style={inputStyle} dir="ltr" />
              <button onClick={verifyOtp} disabled={verifyBusy || !phone || !otp} style={{ ...pillBtn, background: P.green, color: '#fff', fontSize: 12 }}>تایید موبایل</button>
            </div>
            <div style={{ fontSize: 11, color: P.muted }}>وضعیت موبایل: {account?.phoneVerified ? 'تایید شده' : 'تایید نشده'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${P.line}`, paddingTop: 10 }}>
              <span style={{ fontSize: 12, color: P.muted }}>ورود دومرحله‌ای: {account?.twoFactorEnabled ? 'فعال' : 'غیرفعال'}</span>
              <button onClick={toggleTwoFactor} disabled={verifyBusy || (!account?.twoFactorEnabled && !account?.phoneVerified)} style={{ ...pillBtn, background: account?.twoFactorEnabled ? '#fff' : P.green, color: account?.twoFactorEnabled ? P.terracotta : '#fff', border: `1px solid ${P.line}`, fontSize: 12 }}>
                {account?.twoFactorEnabled ? 'غیرفعال‌سازی' : 'فعال‌سازی SMS'}
              </button>
            </div>
          </div>
        </div>
        {'PushManager' in window && (
          <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: P.ink, marginBottom: 10 }}>اعلان‌های مرورگر</div>
            {pushBlocked ? (
              <div style={{ fontSize: 12, color: P.muted }}>مرورگر شما اجازه اعلان را مسدود کرده است. برای فعال‌سازی، از تنظیمات مرورگر اجازه دهید.</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: P.muted }}>
                  اعلان‌های مقالات جدید و نظرات: {pushEnabled ? 'فعال' : 'غیرفعال'}
                </span>
                <button
                  disabled={pushBusy}
                  onClick={async () => {
                    setPushBusy(true);
                    try {
                      if (pushEnabled) {
                        await pushApi.unsubscribe();
                        setPushEnabled(false);
                        toast('اعلان‌های مرورگر غیرفعال شد');
                      } else {
                        const perm = typeof Notification !== 'undefined' ? await Notification.requestPermission() : 'denied';
                        if (perm === 'granted') {
                          await pushApi.subscribe();
                          setPushEnabled(true);
                          toast('اعلان‌های مرورگر فعال شد');
                        } else {
                          setPushBlocked(true);
                        }
                      }
                    } catch { toast('عملیات ناموفق بود', 'error'); }
                    finally { setPushBusy(false); }
                  }}
                  style={{ ...pillBtn, background: pushEnabled ? '#fff' : P.green, color: pushEnabled ? P.terracotta : '#fff', border: `1px solid ${P.line}`, fontSize: 12, opacity: pushBusy ? 0.6 : 1 }}
                >
                  {pushBusy ? '…' : pushEnabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                </button>
              </div>
            )}
          </div>
        )}
        <NotificationPreferencesPanel />
        {error && <div style={{ fontSize: 13, color: '#C94C4C', marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ ...pillBtn, background: P.panel, color: P.ink, border: `1px solid ${P.line}`, padding: '9px 20px' }}>انصراف</button>
          <button onClick={save} disabled={busy} style={{ ...pillBtn, background: P.terracotta, color: '#fff', padding: '9px 20px', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'ذخیره'}</button>
        </div>
      </div>
    </div>
  );
}

function NotificationPreferencesPanel() {
  const toast = useToast();
  const EVENT_LABELS = {
    comment: 'نظر جدید روی مقاله',
    comment_reply: 'پاسخ به نظر',
    new_article: 'مقاله جدید از نویسندگان دنبال‌شده',
    review_approved: 'تأیید مقاله',
    review_revision: 'بازخورد ویراستار',
    review_rejected: 'رد مقاله',
    review_submitted: 'ارسال مقاله برای بررسی',
    system: 'پیام‌های سیستمی',
  };
  const CHANNEL_LABELS = { push: 'مرورگر', email: 'ایمیل', sms: 'پیامک' };
  const CHANNELS = ['push', 'email', 'sms'];

  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    notificationPreferencesApi.get().then((data) => setPrefs(data.preferences)).catch(() => {});
  }, [open]);

  const toggle = async (eventType, channel) => {
    if (!prefs) return;
    const updated = prefs.map((p) =>
      p.eventType === eventType && p.channel === channel ? { ...p, enabled: !p.enabled } : p,
    );
    setPrefs(updated);
    setSaving(true);
    try {
      await notificationPreferencesApi.update(updated);
    } catch {
      toast('ذخیره تنظیمات ناموفق بود', 'error');
      setPrefs(prefs); // revert
    } finally {
      setSaving(false);
    }
  };

  const getEnabled = (eventType, channel) =>
    prefs?.find((p) => p.eventType === eventType && p.channel === channel)?.enabled ?? true;

  return (
    <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: P.ink }}>تنظیمات اعلان‌ها</span>
        <span style={{ fontSize: 12, color: P.muted }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          {prefs === null ? (
            <div style={{ fontSize: 12, color: P.muted }}>در حال بارگذاری…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'right', paddingLeft: 8, paddingBottom: 8, color: P.muted, fontWeight: 600 }}>رویداد</th>
                  {CHANNELS.map((ch) => (
                    <th key={ch} style={{ textAlign: 'center', paddingBottom: 8, color: P.muted, fontWeight: 600, minWidth: 48 }}>{CHANNEL_LABELS[ch]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(EVENT_LABELS).map(([evt, label]) => (
                  <tr key={evt} style={{ borderTop: `1px solid ${P.line}` }}>
                    <td style={{ paddingTop: 6, paddingBottom: 6, color: P.ink, paddingLeft: 8 }}>{label}</td>
                    {CHANNELS.map((ch) => (
                      <td key={ch} style={{ textAlign: 'center', paddingTop: 6, paddingBottom: 6 }}>
                        <button
                          disabled={saving}
                          onClick={() => toggle(evt, ch)}
                          style={{
                            width: 28, height: 16, borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer',
                            background: getEnabled(evt, ch) ? P.green : '#CCC',
                            opacity: saving ? 0.6 : 1, transition: 'background 0.2s',
                          }}
                          title={getEnabled(evt, ch) ? 'فعال — برای غیرفعال‌سازی کلیک کنید' : 'غیرفعال — برای فعال‌سازی کلیک کنید'}
                        />
                      </td>
                    ))}
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

// ── Inline SVG sparkline ─────────────────────────────────────────────────────
function Sparkline({ data, color = '#C45C3D', width = 120, height = 36 }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const vals = data.map(d => d.views ?? 0);
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity="0.12" stroke="none" />
    </svg>
  );
}

// ── Writer analytics tab ──────────────────────────────────────────────────────
function WriterAnalyticsTab() {
  const [overview, setOverview] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      engagementApi.writerAnalyticsOverview().catch(() => null),
      engagementApi.writerAnalyticsArticles().catch(() => ({ items: [] })),
    ]).then(([ov, arts]) => {
      if (!cancelled) {
        setOverview(ov);
        setArticles(arts?.items ?? []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: P.muted, fontSize: 14 }}>در حال بارگذاری…</div>;

  const totalViews = overview?.views ?? 0;
  const totalReactions = overview?.reactions ?? 0;
  const totalComments = overview?.comments ?? 0;
  const viewsByDay = overview?.viewsByDay ?? [];

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'بازدید کل', value: totalViews.toLocaleString('fa-IR'), color: P.terracotta },
          { label: 'واکنش‌ها', value: totalReactions.toLocaleString('fa-IR'), color: P.orange },
          { label: 'نظرات', value: totalComments.toLocaleString('fa-IR'), color: P.green },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: P.white, border: `1px solid ${P.line}`, borderRadius: 12, padding: 16, borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 30-day views sparkline */}
      {viewsByDay.length > 1 && (
        <div style={{ background: P.white, border: `1px solid ${P.line}`, borderRadius: 12, padding: 18, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, marginBottom: 12 }}>بازدید ۳۰ روز اخیر</div>
          <Sparkline data={viewsByDay} color={P.terracotta} width={500} height={56} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: P.muted, marginTop: 4 }}>
            <span>{viewsByDay[0]?.date?.slice(5) ?? ''}</span>
            <span>{viewsByDay[viewsByDay.length - 1]?.date?.slice(5) ?? ''}</span>
          </div>
        </div>
      )}

      {/* Per-article table */}
      {articles.length > 0 && (
        <div style={{ background: P.white, border: `1px solid ${P.line}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${P.line}`, fontSize: 13, fontWeight: 700, color: P.ink }}>عملکرد مقاله‌ها</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif' }}>
              <thead>
                <tr style={{ background: P.panel }}>
                  {['عنوان', 'بازدید', 'واکنش', 'نظر', 'ذخیره'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'right', color: P.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles.map((a, i) => (
                  <tr key={a.id} style={{ borderTop: `1px solid ${P.line}`, background: i % 2 === 0 ? P.white : P.cream }}>
                    <td style={{ padding: '8px 14px', color: P.ink, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</td>
                    <td style={{ padding: '8px 14px', color: P.terracotta, fontWeight: 700 }}>{(a.views ?? 0).toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '8px 14px', color: P.orange }}>{(a.reactions ?? 0).toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '8px 14px', color: P.muted }}>{(a.comments ?? 0).toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '8px 14px', color: P.muted }}>{(a.saved ?? 0).toLocaleString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {articles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: P.muted, fontSize: 14 }}>هنوز داده‌ای برای نمایش وجود ندارد.</div>
      )}
    </div>
  );
}

// ── Main profile page ─────────────────────────────────────────────────────────
export function UserProfilePage({ username }) {
  const { navigate } = useNav();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [followers, setFollowers] = useState({ count: 0, following: false });
  const [history, setHistory] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('articles');

  const slug = username.replace(/^@/, '');
  const isOwn = me && (me.username === slug || me.id === profile?.id);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/api/profile/${slug}`)
      .then(d => { if (!cancelled) setProfile(d.profile); })
      .catch(() => {
        if (cancelled) return;
        // Fallback: check if this username matches a known static author
        const author = TeknavData.authors.find(a => a.username === slug || a.slug === slug);
        if (author) {
          const authorArticles = TeknavData.articles
            .filter(a => (a.authorId === author.id || a.authorName === author.name) && a.status === 'منتشرشده')
            .map(a => ({ id: a.id, slug: a.slug, title: a.title, summary: a.summary, publishedAt: a.dateEn ? `${a.dateEn}T09:00:00+03:30` : null, views: a.views ?? 0, reactions: a.reactions ?? 0 }));
          setProfile({
            id: author.id,
            username: author.username,
            name: author.name,
            bio: author.bio,
            avatarUrl: null,
            role: 'writer',
            createdAt: author.joinedDate ? new Date(author.joinedDate).toISOString() : null,
            author: {
              articles: authorArticles,
              articleCount: authorArticles.length,
              verifiedExpert: author.verifiedExpert ?? false,
              verificationNote: author.verificationNote ?? author.specialty,
            },
            // Extended static fields
            _static: true,
            expertise: author.expertise ?? [],
            education: author.education ?? null,
            social: author.social ?? {},
            specialty: author.specialty,
          });
        } else {
          setProfile(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.username || !['writer', 'editor', 'admin'].includes(profile.role)) return;
    engagementApi.writerFollowers(profile.username)
      .then(res => { if (!cancelled) setFollowers({ count: res?.count ?? 0, following: !!res?.following }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile?.username, profile?.role]);

  useEffect(() => {
    let cancelled = false;
    if (!isOwn) return;
    Promise.all([
      engagementApi.listHistory({ limit: 20 }).catch(() => ({ items: [] })),
      engagementApi.following().catch(() => ({ items: [] })),
    ]).then(([historyRes, followingRes]) => {
      if (!cancelled) {
        setHistory(historyRes?.items ?? []);
        setFollowing(followingRes?.items ?? []);
      }
    });
    return () => { cancelled = true; };
  }, [isOwn]);

  if (loading) {
    return (
      <div style={{ paddingTop: 120, textAlign: 'center', fontFamily: 'Vazirmatn,sans-serif', color: P.muted }}>در حال بارگذاری…</div>
    );
  }

  if (!profile) {
    return <EmptyState title="پروفایل یافت نشد" subtitle={`@${slug} وجود ندارد یا هنوز نام کاربری تنظیم نکرده.`} />;
  }

  const articles = profile.author?.articles ?? [];
  const articleCount = profile.author?.articleCount ?? 0;
  const showArticles = ['writer', 'editor', 'admin'].includes(profile.role) && articles.length > 0;

  const joinDate = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' }) : '';
  const canFollow = me && !isOwn && ['writer', 'editor', 'admin'].includes(profile.role);
  const toggleFollow = async () => {
    try {
      const res = followers.following
        ? await engagementApi.unfollowWriter(profile.username)
        : await engagementApi.followWriter(profile.username);
      setFollowers({ count: res.count ?? followers.count, following: !!res.following });
    } catch {
      /* follow state remains unchanged */
    }
  };

  return (
    <div style={{ paddingTop: 80, background: P.cream, minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      {/* Hero banner */}
      <div style={{
        background: `linear-gradient(145deg, #FDF6EE 0%, #F7EDE0 55%, #EEF5F0 100%)`,
        borderBottom: `1px solid ${P.line}`,
        padding: '52px 24px 44px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative shapes */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(196,92,61,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 60, width: 160, height: 160, borderRadius: '50%', background: 'rgba(58,125,94,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 30, left: '40%', width: 80, height: 80, borderRadius: '50%', background: 'rgba(212,154,42,0.06)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <AvatarUpload
            user={profile}
            editable={!!isOwn}
            onUploaded={url => setProfile(p => ({ ...p, avatarUrl: url }))}
          />

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: P.ink, margin: 0, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {profile.name}
                {profile.author?.verifiedExpert && <span style={{ fontSize: 11, color: P.terracotta, background: 'rgba(196,92,61,0.08)', border: `1px solid rgba(196,92,61,0.22)`, borderRadius: 999, padding: '2px 9px' }}>متخصص تاییدشده</span>}
              </h1>
              <RolePill role={profile.role} />
            </div>
            <div style={{ fontSize: 13, color: P.terracotta, fontWeight: 600, marginBottom: 8 }}>@{profile.username}</div>
            {profile.author?.verifiedExpert && profile.author?.verificationNote && (
              <div style={{ fontSize: 12, color: P.green, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: P.green, flexShrink: 0 }} />
                {profile.author.verificationNote}
              </div>
            )}
            {profile.bio && <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.85, margin: '0 0 14px', maxWidth: 580 }}>{profile.bio}</p>}
            {profile.expertise?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {profile.expertise.map(tag => (
                  <span key={tag} style={{ fontSize: 11, padding: '3px 11px', borderRadius: 20, background: P.greenLight, color: P.green, border: `1px solid rgba(58,125,94,0.18)`, fontWeight: 500 }}>{tag}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: P.muted, alignItems: 'center' }}>
              {joinDate && <span>عضو از {joinDate}</span>}
              {showArticles && <span style={{ color: P.terracotta, fontWeight: 700 }}>{articleCount} مقاله</span>}
              {['writer', 'editor', 'admin'].includes(profile.role) && !profile._static && <span>{followers.count.toLocaleString('fa-IR')} دنبال‌کننده</span>}
              {profile.social?.twitter && profile.social.twitter !== '#' && (
                <a href={profile.social.twitter} target="_blank" rel="noopener noreferrer" style={{ color: P.muted, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>𝕏</a>
              )}
              {profile.social?.linkedin && profile.social.linkedin !== '#' && (
                <a href={profile.social.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: P.muted, textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>in</a>
              )}
            </div>
          </div>

          {canFollow && (
            <button
              onClick={toggleFollow}
              style={{
                ...pillBtn, background: followers.following ? P.greenLight : 'rgba(196,92,61,0.08)',
                color: followers.following ? P.green : P.terracotta,
                border: `1px solid ${followers.following ? 'rgba(58,125,94,0.28)' : 'rgba(196,92,61,0.25)'}`, padding: '9px 20px', fontSize: 13,
                alignSelf: 'flex-start',
              }}
            >{followers.following ? 'دنبال می‌کنی' : 'دنبال کردن'}</button>
          )}

          {isOwn && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                ...pillBtn, background: 'rgba(196,92,61,0.08)', color: P.terracotta,
                border: `1px solid rgba(196,92,61,0.25)`, padding: '9px 20px', fontSize: 13,
                alignSelf: 'flex-start',
              }}
            >ویرایش پروفایل</button>
          )}
        </div>
      </div>

      {/* Stats bar (for writers/editors) */}
      {showArticles && (
        <div style={{ background: P.panel, borderBottom: `1px solid ${P.line}` }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
            {[
              { label: 'مقالات منتشرشده', value: articleCount },
              { label: 'مجموع بازدید', value: articles.reduce((s, a) => s + (a.views ?? 0), 0).toLocaleString('fa-IR') },
              { label: 'مجموع واکنش', value: articles.reduce((s, a) => s + (a.reactions ?? 0), 0).toLocaleString('fa-IR') },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '18px 32px 18px 0', flex: 1, borderLeft: `1px solid ${P.line}`, lastChild: { borderLeft: 'none' } }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: P.terracotta }}>{value}</div>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Article list */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {isOwn && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }} className="profile-own-grid">
            <div style={{ background: P.white, border: `1px solid ${P.line}`, borderRadius: 12, padding: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: P.ink, margin: '0 0 14px' }}>تاریخچه خواندن</h2>
              {history.length === 0 ? <div style={{ fontSize: 13, color: P.muted }}>هنوز مقاله‌ای در تاریخچه شما ثبت نشده است.</div> : history.slice(0, 5).map(item => (
                <button key={item.id} onClick={() => navigate('/article/' + item.article.slug)} style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${P.line}`, padding: '10px 0', textAlign: 'right', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{item.article.title}</div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>{item.time}</div>
                </button>
              ))}
              {history.length > 0 && <button onClick={async () => { if (confirm('تاریخچه خواندن پاک شود؟')) { await engagementApi.clearHistory(); setHistory([]); } }} style={{ ...pillBtn, background: '#C94C4C18', color: '#C94C4C', fontSize: 12, marginTop: 12 }}>پاک کردن تاریخچه</button>}
            </div>
            <div style={{ background: P.white, border: `1px solid ${P.line}`, borderRadius: 12, padding: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: P.ink, margin: '0 0 14px' }}>نویسندگان دنبال‌شده</h2>
              {following.length === 0 ? <div style={{ fontSize: 13, color: P.muted }}>هنوز نویسنده‌ای را دنبال نمی‌کنید.</div> : following.slice(0, 6).map(writer => (
                <button key={writer.id} onClick={() => navigate('/profile/@' + writer.username)} style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${P.line}`, padding: '10px 0', textAlign: 'right', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{writer.name}</div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>@{writer.username}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {showArticles ? (
          <>
            {isOwn && ['writer', 'editor', 'admin'].includes(profile.role) && (
              <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `2px solid ${P.line}` }}>
                {[{ id: 'articles', label: 'مقالات' }, { id: 'analytics', label: 'آمار و تحلیل' }].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer',
                    fontFamily: 'Vazirmatn,sans-serif', fontSize: 14, fontWeight: activeTab === tab.id ? 800 : 500,
                    color: activeTab === tab.id ? P.terracotta : P.muted,
                    borderBottom: activeTab === tab.id ? `2px solid ${P.terracotta}` : '2px solid transparent',
                    marginBottom: -2, transition: 'all 0.15s',
                  }}>{tab.label}</button>
                ))}
              </div>
            )}
            {activeTab === 'analytics' && isOwn && ['writer', 'editor', 'admin'].includes(profile.role) ? (
              <WriterAnalyticsTab />
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: P.ink, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 20, background: P.terracotta, borderRadius: 2 }} />
                  مقالات
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {articles.map(article => (
                    <ArticleMiniCard
                      key={article.id}
                      article={article}
                      onClick={() => navigate('/article/' + article.slug)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{
            textAlign: 'center', padding: '64px 24px', color: P.muted,
            background: P.panel, borderRadius: 16, border: `1px solid ${P.line}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: P.ink, marginBottom: 8 }}>هنوز مقاله‌ای منتشر نشده</div>
            <div style={{ fontSize: 13 }}>مقالات این کاربر اینجا نمایش داده خواهند شد.</div>
          </div>
        )}
      </div>

      {showSettings && (
        <ProfileSettingsModal
          user={profile}
          account={me}
          onClose={() => setShowSettings(false)}
          onSaved={updated => setProfile(p => ({ ...p, ...updated }))}
        />
      )}

      <style>{`
        @media (max-width: 600px) {
          .profile-hero-inner { flex-direction: column !important; align-items: flex-start !important; gap: 20px !important; }
          .profile-own-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
