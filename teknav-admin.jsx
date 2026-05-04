// teknav-admin.jsx — Multi-role admin panel (ES module)
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  useAuth, useNav, useToast,
  AuthorAvatar, CategoryBadge, TypeBadge, StatusBadge, RoleBadge,
  ConfirmModal, EmptyState,
  inputStyle, pillBtn,
} from './teknav-ui.jsx';
import { DiagramRenderer } from './teknav-diagrams.jsx';
import { sectionTitle } from './teknav-home.jsx';
import { adminApi } from './src/lib/admin-api.js';
import { engagementApi, revisionsApi, presenceApi } from './src/lib/engagement-api.js';

// ── Sidebar ─────────────────────────────────────────────────────────────────
const SIDEBAR_ITEMS = {
  admin: [
    { id: 'dashboard', label: 'داشبورد', icon: '◈' },
    { id: 'articles', label: 'مدیریت مقاله‌ها', icon: '◉' },
    { id: 'create', label: 'مقاله جدید', icon: '⊕' },
    { id: 'users', label: 'مدیریت کاربران', icon: '◐' },
    { id: 'authors', label: 'مدیریت نویسندگان', icon: '✍' },
    { id: 'media', label: 'کتابخانه رسانه', icon: '▣' },
    { id: 'comments', label: 'نظرها', icon: '◌' },
    { id: 'analytics', label: 'تحلیل محتوا', icon: '▤' },
    { id: 'reviews', label: 'گردش بررسی', icon: '◇' },
    { id: 'newsletter', label: 'خبرنامه', icon: '✉' },
    { id: 'series', label: 'سری مقاله‌ها', icon: '▥' },
    { id: 'categories', label: 'دسته‌بندی‌ها', icon: '⬡' },
    { id: 'tags', label: 'برچسب‌ها', icon: '⬟' },
    { id: 'seo-audit', label: 'ممیزی SEO', icon: '◈' },
    { id: 'jobs', label: 'آگهی‌های شغلی', icon: '◑' },
    { id: 'client-errors', label: 'خطاهای کلاینت', icon: '⚠' },
    { id: 'activity', label: 'گزارش فعالیت', icon: '◷' },
  ],
  editor: [
    { id: 'dashboard', label: 'داشبورد تحریریه', icon: '◈' },
    { id: 'articles', label: 'مقاله‌ها', icon: '◉' },
    { id: 'create', label: 'مقاله جدید', icon: '⊕' },
    { id: 'authors', label: 'نویسندگان', icon: '✍' },
    { id: 'media', label: 'کتابخانه رسانه', icon: '▣' },
    { id: 'comments', label: 'نظرها', icon: '◌' },
    { id: 'analytics', label: 'تحلیل محتوا', icon: '▤' },
    { id: 'reviews', label: 'گردش بررسی', icon: '◇' },
    { id: 'newsletter', label: 'خبرنامه', icon: '✉' },
    { id: 'series', label: 'سری مقاله‌ها', icon: '▥' },
    { id: 'categories', label: 'دسته‌بندی‌ها', icon: '⬡' },
  ],
  writer: [
    { id: 'dashboard', label: 'داشبورد من', icon: '◈' },
    { id: 'create', label: 'نوشتن مقاله', icon: '⊕' },
    { id: 'articles', label: 'مقاله‌های من', icon: '◉' },
    { id: 'analytics', label: 'تحلیل نوشته‌ها', icon: '▤' },
    { id: 'reviews', label: 'گردش بررسی', icon: '◇' },
  ],
  reviewer: [
    { id: 'dashboard', label: 'داشبورد', icon: '◈' },
    { id: 'articles', label: 'برای بررسی', icon: '◉' },
    { id: 'reviews', label: 'گردش بررسی', icon: '◇' },
  ],
};

const BRAND = {
  primary: '#0F6B73',
  primaryDark: '#073F45',
  ink: '#0F2A2E',
  muted: '#5F6B6D',
  cream: '#FAF7F0',
  panel: '#F4EFE6',
  line: '#E4DDD2',
  gold: '#D49A2A',
  terracotta: '#C46A4D',
};

const BASE_DIAGRAM_CHOICES = [
  { id: 'neural', label: 'هوش مصنوعی' },
  { id: 'pipeline', label: 'فرآیند داده' },
  { id: 'growth', label: 'رشد' },
  { id: 'cyber', label: 'امنیت' },
  { id: 'chip', label: 'سخت‌افزار' },
  { id: 'arch', label: 'معماری' },
  { id: 'timeline', label: 'زمان‌بندی' },
  { id: 'wave', label: 'Wave Stream' },
  { id: 'orbit', label: 'System Orbit' },
  { id: 'brain', label: 'رابط عصبی' },
  { id: 'database', label: 'ساختار داده' },
  { id: 'cloud', label: 'زیرساخت ابری' },
  { id: 'quantum', label: 'کوانتوم' },
  { id: 'vla', label: 'مدل رباتیک' },
  { id: 'dna', label: 'بیوتکنولوژی' },
  { id: 'fusion', label: 'انرژی هسته‌ای' },
  { id: 'satellite', label: 'فضا و ماهواره' },
  { id: 'blockchain', label: 'بلاک‌چین' },
];

const EXTRA_DIAGRAM_CHOICES = Array.from({ length: 192 }, (_, idx) => {
  const no = String(idx + 1).padStart(3, '0');
  return { id: `diagram-${no}`, label: `دیاگرام تخصصی ${no}` };
});

const DIAGRAM_CHOICES = [...BASE_DIAGRAM_CHOICES, ...EXTRA_DIAGRAM_CHOICES];

function PanelState({ loading, error, empty, emptyTitle = 'داده‌ای برای نمایش وجود ندارد' }) {
  if (loading) return <div style={{ color: '#5F6B6D', fontSize: 13, padding: '20px 0', direction: 'rtl' }}>در حال بارگذاری داده‌های واقعی از سرور...</div>;
  if (error) return <EmptyState title="اتصال به API برقرار نشد" subtitle="داده نمونه نمایش داده نمی‌شود. پس از اتصال به بک‌اند دوباره تلاش کنید." />;
  if (empty) return <EmptyState title={emptyTitle} />;
  return null;
}

function AdminSidebar({ activeTab, onTab, user, open, onClose }) {
  const items = SIDEBAR_ITEMS[user?.role] || SIDEBAR_ITEMS.writer;
  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 299, display: 'none' }} className="admin-overlay" />}
      <aside className={`admin-sidebar${open ? ' open' : ''}`} style={{ width: 256, background: `linear-gradient(180deg,${BRAND.primaryDark} 0%,${BRAND.primary} 52%,#0A3136 100%)`, minHeight: '100%', padding: '22px 0', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '-14px 0 40px rgba(15,42,46,0.16)' }}>
      <div style={{ padding: '0 22px 22px', borderBottom: '1px solid rgba(250,247,240,0.14)' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4, fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>تکناو</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.02em' }}>پنل تولید محتوا</div>
      </div>
      <div style={{ padding: '18px 12px', flex: 1 }}>
        {items.map(item => (
          <button key={item.id} onClick={() => onTab(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'right',
            padding: '12px 14px', marginBottom: 6, background: activeTab === item.id ? 'rgba(250,247,240,0.96)' : 'transparent',
            border: '1px solid', borderColor: activeTab === item.id ? 'rgba(250,247,240,0.95)' : 'transparent',
            borderRadius: 12,
            color: activeTab === item.id ? BRAND.primary : 'rgba(255,255,255,0.74)', fontSize: 13,
            fontFamily: 'Vazirmatn,sans-serif', fontWeight: activeTab === item.id ? 800 : 600, cursor: 'pointer', transition: 'all 0.18s',
            boxShadow: activeTab === item.id ? '0 12px 28px rgba(0,0,0,0.18)' : 'none',
          }}>
            <span style={{ fontSize: 15, width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: activeTab === item.id ? `${BRAND.primary}14` : 'rgba(255,255,255,0.10)' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(250,247,240,0.14)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginBottom: 6 }}>{user?.name}</div>
        <RoleBadge role={user?.role} />
      </div>
    </aside>
    </>
  );
}

// ── Dashboard Stats ─────────────────────────────────────────────────────────
function DashboardStats({ role }) {
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    adminApi.getDashboard()
      .then(res => { if (!cancelled) setStatsData(res); })
      .catch(() => { if (!cancelled) { setStatsData(null); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  if (loading || error || !statsData || statsData.totalArticles === 0) {
    return (
      <div style={{ marginBottom: 28 }}>
        <PanelState loading={loading} error={error} empty={!loading && !error && (!statsData || statsData.totalArticles === 0)} emptyTitle="هنوز داده‌ای برای آمار پنل ثبت نشده است" />
      </div>
    );
  }
  const published = statsData.published ?? 0;
  const pending = statsData.pending ?? 0;
  const drafts = statsData.drafts ?? 0;
  const totalViews = statsData.totalViews ?? 0;

  const adminStats = [
    { label: 'مقاله منتشرشده', value: published, color: '#2F8F6B', icon: '◉' },
    { label: 'در انتظار بررسی', value: pending, color: '#D08A22', icon: '◷' },
    { label: 'پیش‌نویس', value: drafts, color: '#5F6B6D', icon: '◐' },
    { label: 'مجموع بازدید', value: totalViews.toLocaleString('fa'), color: '#0F6B73', icon: '◈' },
    { label: 'کاربران', value: statsData.totalUsers ?? 0, color: '#3A7D5E', icon: '◐' },
    { label: 'رسانه‌ها', value: statsData.totalMedia ?? 0, color: '#C46A4D', icon: '▣' },
  ];

  const editorStats = [
    { label: 'در انتظار تأیید', value: pending, color: '#D08A22', icon: '◷' },
    { label: 'منتشرشده', value: published, color: '#2F8F6B', icon: '◉' },
    { label: 'نیازمند اصلاح', value: statsData.needsRevision ?? 0, color: '#C94C4C', icon: '⚠' },
  ];

  const writerStats = [
    { label: 'مقاله منتشرشده', value: published, color: '#2F8F6B', icon: '◉' },
    { label: 'پیش‌نویس', value: drafts, color: '#5F6B6D', icon: '◐' },
    { label: 'در انتظار بررسی', value: pending, color: '#D08A22', icon: '◷' },
  ];

  const stats = role === 'admin' ? adminStats : role === 'editor' ? editorStats : writerStats;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: '20px 20px', borderTop: `3px solid ${s.color}` }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</div>
          <div style={{ fontSize: 13, color: '#5F6B6D' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Articles Management ─────────────────────────────────────────────────────
function ArticlesManagement({ role, onEdit }) {
  const { navigate } = useNav();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [freshnessFilter, setFreshnessFilter] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const PAGE_SIZE = 15;

  const refresh = () => {
    setLoading(true);
    setError(false);
    return adminApi.listArticles({ limit: 100 })
      .then(res => setArticles(res.items ?? []))
      .catch(() => { setArticles([]); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (role !== 'admin' && role !== 'editor') return undefined;
    const es = new EventSource('/api/admin/stream', { withCredentials: true });
    es.addEventListener('view_update', event => {
      const data = JSON.parse(event.data);
      setArticles(list => list.map(article => article.id === data.articleId ? { ...article, views: data.views } : article));
    });
    return () => es.close();
  }, [role]);

  const filtered = useMemo(() => {
    let list = articles;
    if (role === 'reviewer') list = articles.filter(a => a.status === 'در انتظار بررسی');
    if (search) { const q = search.toLowerCase(); list = list.filter(a => a.title.toLowerCase().includes(q) || a.authorName?.toLowerCase().includes(q)); }
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (freshnessFilter) list = list.filter(a => a.contentFreshnessStatus === freshnessFilter);
    return list;
  }, [articles, search, statusFilter, freshnessFilter, role]);

  const changeStatus = async (id, newStatus) => {
    try {
      if (newStatus === 'منتشرشده') await adminApi.publishArticle(id);
      else await adminApi.updateArticle(id, { status: newStatus });
      toast('وضعیت مقاله تغییر کرد');
      refresh();
    } catch (err) {
      if (err?.body?.error === 'quality_check_failed') {
        toast(`انتشار متوقف شد: ${err.body.issues?.join('، ')}`, 'error');
      } else {
        toast('خطا در تغییر وضعیت مقاله', 'error');
      }
    }
  };

  const deleteArt = async (id) => {
    try {
      await adminApi.deleteArticle(id);
      toast('مقاله حذف شد');
      refresh();
    } catch {
      toast('خطا در حذف مقاله', 'error');
    }
    setConfirm(null);
  };

  const statusOptions = ['منتشرشده', 'پیش‌نویس', 'در انتظار بررسی', 'نیازمند اصلاح', 'زمان‌بندی‌شده'];

  return (
    <div>
      {confirm && <ConfirmModal msg={`آیا از حذف این مقاله اطمینان دارید؟`} onConfirm={() => deleteArt(confirm)} onCancel={() => setConfirm(null)} />}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی مقاله..." style={{ ...inputStyle, maxWidth: 260 }} dir="rtl" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }} dir="rtl">
          <option value="">همه وضعیت‌ها</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={freshnessFilter} onChange={e => setFreshnessFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }} dir="rtl">
          <option value="">همه تازگی‌ها</option>
          <option value="current">به‌روز</option>
          <option value="needs_update">نیاز به بازنگری</option>
          <option value="scheduled_refresh">بازنگری برنامه‌ریزی‌شده</option>
          <option value="archived">آرشیو</option>
        </select>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, direction: 'rtl' }}>
            <thead>
              <tr style={{ background: '#F4EFE6', borderBottom: '1px solid #E4DDD2' }}>
                {['عنوان', 'نویسنده', 'دسته', 'وضعیت', 'بازدید', 'تاریخ', 'اقدام'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'right', color: '#5F6B6D', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(showAll ? filtered : filtered.slice(0, PAGE_SIZE)).map((a, i) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #E4DDD2', background: i % 2 === 0 ? '#fff' : '#FDFBF7' }}>
                  <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                    <div style={{ fontWeight: 600, color: '#263238', cursor: 'pointer' }} onClick={() => navigate('/article/' + a.slug)}>{a.title.slice(0, 50)}{a.title.length > 50 ? '…' : ''}</div>
                    <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>{a.readTime} دقیقه · {a.type}</div>
                    {a.status === 'نیازمند اصلاح' && a.reviewNote && (
                      <div style={{ marginTop: 6, padding: '5px 9px', background: 'rgba(200,149,28,0.10)', border: '1px solid rgba(200,149,28,0.28)', borderRadius: 6, fontSize: 11, color: '#7A5A00', lineHeight: 1.7 }}>
                        ⚠ {a.reviewNote}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#5F6B6D' }}>{a.authorName}</td>
                  <td style={{ padding: '12px 16px' }}><CategoryBadge name={a.categoryName} small /></td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={a.status} /></td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 12, color: '#5F6B6D' }}>{(a.views ?? 0).toLocaleString('fa-IR')}</td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: 12, color: '#5F6B6D' }}>{a.date}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(role === 'admin' || role === 'editor') && a.status === 'در انتظار بررسی' && (
                        <>
                          <button onClick={() => changeStatus(a.id, 'منتشرشده')} style={{ ...actionBtn, background: '#2F8F6B18', color: '#2F8F6B' }}>تأیید</button>
                          <button onClick={() => changeStatus(a.id, 'نیازمند اصلاح')} style={{ ...actionBtn, background: '#C94C4C18', color: '#C94C4C' }}>رد</button>
                        </>
                      )}
                      {role === 'writer' && a.status === 'پیش‌نویس' && (
                        <button onClick={() => changeStatus(a.id, 'در انتظار بررسی')} style={{ ...actionBtn, background: '#D49A2A18', color: '#D49A2A' }}>ارسال</button>
                      )}
                      {role === 'reviewer' && (
                        <button onClick={() => changeStatus(a.id, 'منتشرشده')} style={{ ...actionBtn, background: '#2F8F6B18', color: '#2F8F6B' }}>تأیید</button>
                      )}
                      <button onClick={() => onEdit(a)} style={{ ...actionBtn, background: '#0F6B7318', color: '#0F6B73' }}>ویرایش</button>
                      {role === 'admin' && (
                        <button onClick={() => setConfirm(a.id)} style={{ ...actionBtn, background: '#C94C4C18', color: '#C94C4C' }}>حذف</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PanelState loading={loading} error={error} empty={!loading && !error && articles.length === 0} emptyTitle="هنوز مقاله‌ای از API دریافت نشده است" />
        {!loading && !error && articles.length > 0 && filtered.length === 0 && <EmptyState title="موردی مطابق فیلترها یافت نشد" />}
        {!loading && !error && filtered.length > PAGE_SIZE && (
          <div style={{ padding: '14px 16px', textAlign: 'center', borderTop: '1px solid #E4DDD2' }}>
            <button
              onClick={() => setShowAll(s => !s)}
              style={{ background: 'none', border: '1px solid #E4DDD2', borderRadius: 8, padding: '7px 20px', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif', fontSize: 12, color: '#5F6B6D' }}
            >
              {showAll
                ? `نمایش کمتر ▴`
                : `نمایش ${(filtered.length - PAGE_SIZE).toLocaleString('fa-IR')} مورد دیگر ▾`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Article Editor ──────────────────────────────────────────────────────────
function ArtifactStudio({ selectedDiagram, onSelectDiagram, onInsert }) {
  const [mode, setMode] = useState('library');
  const [codeType, setCodeType] = useState('mermaid');
  const [code, setCode] = useState('');
  const [uploadState, setUploadState] = useState({ busy: false, message: '' });

  const insertCodeArtifact = () => {
    if (!code.trim()) return;
    const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    onInsert?.(`\n<div class="insight-box"><div class="insight-title">دیاگرام کدنویسی‌شده (${codeType})</div><pre dir="ltr">${safeCode}</pre></div>\n`);
  };
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const insertUploadedFile = (file, url) => {
    const safeName = file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isImage = file.type.startsWith('image/');
    onInsert?.(isImage
      ? `\n<figure><img src="${url}" alt="${safeName}" /><figcaption>${safeName}</figcaption></figure>\n`
      : `\n<p><a href="${url}" target="_blank" rel="noopener">${safeName}</a></p>\n`);
  };
  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setUploadState({ busy: false, message: 'حداکثر حجم فایل برای بارگذاری مستقیم ۱۲ مگابایت است.' });
      return;
    }
    setUploadState({ busy: true, message: 'در حال بارگذاری فایل...' });
    try {
      const dataBase64 = await fileToBase64(file);
      const result = await adminApi.upload({ filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 });
      insertUploadedFile(file, result.url);
      setUploadState({ busy: false, message: 'فایل روی سرور محلی ذخیره و به مقاله اضافه شد.' });
    } catch {
      setUploadState({ busy: false, message: 'اتصال upload در دسترس نبود؛ فایل درج نشد و داده نمونه یا محلی نمایش داده نمی‌شود.' });
    }
  };

  return (
    <section style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 14px 40px rgba(15,42,46,0.06)' }}>
      <div style={{ padding: 18, background: `linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.primaryDark} 100%)`, color: '#fff', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.76, marginBottom: 4 }}>Artifact Writing</div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>کتابخانه دیاگرام و ابزار کدنویسی</h3>
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: 3 }}>
            {[['library', 'قالب‌ها'], ['code', 'کد اختصاصی']].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} style={{ border: 0, borderRadius: 8, padding: '7px 13px', cursor: 'pointer', background: mode === id ? '#fff' : 'transparent', color: mode === id ? BRAND.primary : '#fff', fontWeight: 800, fontSize: 12 }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${BRAND.line}`, background: '#F8FBFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#5F6B6D', lineHeight: 1.7 }}>بارگذاری فایل از همین سرور انجام می‌شود و به CDN خارجی وابسته نیست.</div>
        <label style={{ ...pillBtn, background: uploadState.busy ? '#5F6B6D' : BRAND.primary, color: '#fff', cursor: uploadState.busy ? 'wait' : 'pointer', margin: 0 }}>
          {uploadState.busy ? 'در حال بارگذاری...' : 'بارگذاری فایل'}
          <input type="file" disabled={uploadState.busy} onChange={e => handleFileUpload(e.target.files?.[0])} style={{ display: 'none' }} />
        </label>
        {uploadState.message && <div style={{ flexBasis: '100%', fontSize: 11, color: uploadState.message.includes('نبود') || uploadState.message.includes('حداکثر') ? '#C46A4D' : BRAND.primary }}>{uploadState.message}</div>}
      </div>

      {mode === 'library' ? (
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }} className="artifact-grid">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, maxHeight: 360, overflowY: 'auto', paddingLeft: 4 }}>
              {DIAGRAM_CHOICES.map(t => (
                <button key={t.id} onClick={() => onSelectDiagram(t.id)} title={t.label} style={{
                  textAlign: 'right', border: `1px solid ${selectedDiagram === t.id ? BRAND.primary : BRAND.line}`,
                  background: selectedDiagram === t.id ? `${BRAND.primary}10` : '#fff', borderRadius: 12, padding: 12, cursor: 'pointer',
                  boxShadow: selectedDiagram === t.id ? '0 8px 24px rgba(15,107,115,0.12)' : 'none',
                }}>
                  <div style={{ height: 56, borderRadius: 10, marginBottom: 9, overflow: 'hidden', background: '#F4F0EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 400, flexShrink: 0, transform: 'scale(0.33)', transformOrigin: 'center', pointerEvents: 'none' }}>
                      <DiagramRenderer type={t.id} compact />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.ink, lineHeight: 1.5 }}>{t.label}</div>
                </button>
              ))}
            </div>
            <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.primary, marginBottom: 10 }}>پیش‌نمایش زنده</div>
              <div style={{ background: '#fff', borderRadius: 12, padding: 10, minHeight: 180, display: 'flex', alignItems: 'center' }}>
                <DiagramRenderer type={selectedDiagram || DIAGRAM_CHOICES[0].id} compact />
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 11, lineHeight: 1.8, color: '#5F6B6D' }}>فقط دیاگرام‌های واقعی پشتیبانی‌شده در کد نمایش داده می‌شوند؛ قالب نمونه یا محتوای آزمایشی درج نمی‌شود.</p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="artifact-grid">
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['mermaid', 'plantuml', 'd2'].map(t => (
                <button key={t} onClick={() => setCodeType(t)} style={{ ...actionBtn, background: codeType === t ? `${BRAND.primary}18` : BRAND.panel, color: codeType === t ? BRAND.primary : '#5F6B6D', padding: '7px 12px' }}>{t}</button>
              ))}
            </div>
            <textarea value={code} onChange={e => setCode(e.target.value)} rows={13} spellCheck={false} style={{ ...inputStyle, direction: 'ltr', textAlign: 'left', fontFamily: 'Consolas, monospace', lineHeight: 1.6, resize: 'vertical' }} />
            <button onClick={insertCodeArtifact} style={{ ...pillBtn, background: BRAND.primary, color: '#fff', marginTop: 10 }}>درج به عنوان Artifact قابل ویرایش</button>
          </div>
          <div style={{ background: '#101A1C', color: '#DDEBE9', borderRadius: 14, padding: 16, minHeight: 290, direction: 'ltr', overflow: 'hidden', border: '1px solid rgba(15,107,115,0.45)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#8CCFD2', fontSize: 11 }}>
              <span>code preview</span><span style={{ opacity: 0.7 }}>{codeType}</span>
            </div>
            {code.trim() ? (
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, lineHeight: 1.7, flex: 1, overflowY: 'auto' }}>{code}</pre>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A6A6C', fontSize: 12, textAlign: 'center', lineHeight: 1.8 }}>
                کد {codeType} را در کادر چپ بنویسید.<br />
                <span style={{ opacity: 0.6, fontSize: 10 }}>render در مرورگر پس از درج انجام می‌شود.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── HTML Editor with toolbar + image upload ─────────────────────────────────
function HtmlEditor({ value, onChange }) {
  const ref = useRef(null);
  const toast = useToast();
  const [webp, setWebp] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const fileRef = useRef(null);

  const exec = useCallback((tag, attrs = '') => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = value.slice(start, end) || 'متن';
    let insertion = '';
    if (tag === 'hr') insertion = '\n<hr />\n';
    else if (tag === 'a') insertion = `<a href="URL">${sel}</a>`;
    else if (tag === 'img') insertion = `<img src="${attrs}" alt="" style="max-width:100%;border-radius:8px;margin:12px 0" />`;
    else if (['h2','h3','blockquote','pre'].includes(tag)) insertion = `<${tag}>${sel}</${tag}>`;
    else if (tag === 'ul') insertion = `<ul>\n  <li>${sel}</li>\n</ul>`;
    else if (tag === 'ol') insertion = `<ol>\n  <li>${sel}</li>\n</ol>`;
    else insertion = `<${tag}>${sel}</${tag}>`;
    const next = value.slice(0, start) + insertion + value.slice(end);
    onChange(next);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + insertion.length; }, 0);
  }, [value, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); exec('strong'); }
      else if (e.key === 'i') { e.preventDefault(); exec('em'); }
    }
  }, [exec]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgUploading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const res = await adminApi.upload({ filename: file.name, mimeType: file.type, dataBase64: base64, webp });
      if (res?.url) { exec('img', res.url); toast('تصویر بارگذاری شد'); }
      else toast('خطا در بارگذاری تصویر', 'error');
    } catch { toast('خطا در بارگذاری تصویر', 'error'); }
    finally { setImgUploading(false); e.target.value = ''; }
  };

  const [hoveredBtn, setHoveredBtn] = useState(null);

  const TB = ({ id, label, onClick, title, bold, mono }) => {
    const isHovered = hoveredBtn === id;
    return (
      <button
        type="button"
        title={title || label}
        onClick={onClick}
        onMouseEnter={() => setHoveredBtn(id)}
        onMouseLeave={() => setHoveredBtn(null)}
        style={{
          padding: '4px 9px', border: '1px solid', borderRadius: 5, cursor: 'pointer',
          fontFamily: mono ? 'monospace' : 'Vazirmatn,sans-serif',
          fontSize: mono ? 11 : 12,
          fontWeight: bold ? 700 : 400,
          background: isHovered ? '#EFE9E0' : '#fff',
          color: isHovered ? '#C46A4D' : '#263238',
          borderColor: isHovered ? '#C8951C' : '#D4C9B8',
          transition: 'background 0.12s, color 0.12s, border-color 0.12s',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >{label}</button>
    );
  };

  const TBSep = () => (
    <div style={{ width: 1, alignSelf: 'stretch', background: '#D4C9B8', margin: '2px 3px' }} />
  );

  const wordCount = value.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const charCount = value.replace(/<[^>]*>/g, '').length;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: '7px 10px', background: '#F9F7F4', border: '1px solid #E4DDD2', borderRadius: '8px 8px 0 0', direction: 'ltr' }}>
        {/* Formatting group */}
        <TB id="bold" label="B" title="Bold (Ctrl+B)" onClick={() => exec('strong')} bold />
        <TB id="italic" label="I" title="Italic (Ctrl+I)" onClick={() => exec('em')} />
        <TBSep />
        {/* Headings group */}
        <TB id="h2" label="H2" title="Heading 2" onClick={() => exec('h2')} />
        <TB id="h3" label="H3" title="Heading 3" onClick={() => exec('h3')} />
        <TBSep />
        {/* Inline / block group */}
        <TB id="link" label="🔗" title="Link" onClick={() => exec('a')} />
        <TB id="bq" label="«»" title="Blockquote" onClick={() => exec('blockquote')} />
        <TB id="code" label="</>" title="Inline code" onClick={() => exec('code')} mono />
        <TB id="pre" label="{ }" title="Code block" onClick={() => exec('pre')} mono />
        <TBSep />
        {/* List / HR group */}
        <TB id="ul" label="≡" title="Bullet list" onClick={() => exec('ul')} />
        <TB id="ol" label="1." title="Numbered list" onClick={() => exec('ol')} />
        <TB id="hr" label="—" title="Horizontal rule" onClick={() => exec('hr')} />
        <TBSep />
        {/* Media group */}
        <label
          title="بارگذاری تصویر"
          onMouseEnter={() => setHoveredBtn('img')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            padding: '4px 9px', border: '1px solid', borderRadius: 5, cursor: 'pointer',
            fontSize: 12,
            background: hoveredBtn === 'img' ? '#EFE9E0' : '#fff',
            color: hoveredBtn === 'img' ? '#C46A4D' : '#263238',
            borderColor: hoveredBtn === 'img' ? '#C8951C' : '#D4C9B8',
            transition: 'background 0.12s, color 0.12s, border-color 0.12s',
            display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1, userSelect: 'none',
          }}
        >
          🖼 {imgUploading ? '...' : 'تصویر'}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5F6B6D', cursor: 'pointer', marginInlineStart: 2 }}>
          <input type="checkbox" checked={webp} onChange={e => setWebp(e.target.checked)} />
          WebP
        </label>
      </div>
      {/* Textarea */}
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={18}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8, direction: 'rtl', borderTop: 'none', borderBottom: 'none', borderRadius: 0, fontFamily: 'monospace', fontSize: 13 }}
        dir="rtl"
        placeholder="<p>محتوای مقاله را اینجا بنویسید...</p>"
      />
      {/* Footer: word / char count */}
      <div style={{ display: 'flex', gap: 16, padding: '5px 12px', background: '#F9F7F4', border: '1px solid #E4DDD2', borderTop: 'none', borderRadius: '0 0 8px 8px', fontSize: 11, color: '#8A9A9B', direction: 'ltr' }}>
        <span>{wordCount.toLocaleString('fa-IR')} کلمه</span>
        <span>{charCount.toLocaleString('fa-IR')} کاراکتر</span>
      </div>
    </div>
  );
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function RevisionDrawer({ articleId, canRestore, onClose, onRestored }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    setData(null);
    revisionsApi.list(articleId, page).then(setData).catch(() => setData({ items: [], total: 0, pages: 1 }));
  }, [articleId, page]);

  const openRevision = async (rev) => {
    setSelected(rev);
    setContent(null);
    try {
      const d = await revisionsApi.get(articleId, rev.id);
      setContent(d.revision.content);
    } catch {
      setContent('بارگذاری محتوا ناموفق بود');
    }
  };

  const restore = async () => {
    if (!selected) return;
    setRestoring(true);
    try {
      await revisionsApi.restore(articleId, selected.id);
      toast('نسخه قبلی بازیابی شد');
      onRestored?.();
    } catch {
      toast('بازیابی ناموفق بود', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const fmtDate = (iso) => new Date(iso).toLocaleString('fa-IR');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, background: '#FAF7F0', display: 'flex', flexDirection: 'column', direction: 'rtl', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E4DDD2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#263238' }}>تاریخچه نسخه‌ها</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#5F6B6D' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {!data ? (
            <div style={{ color: '#5F6B6D', fontSize: 13 }}>در حال بارگذاری…</div>
          ) : data.items.length === 0 ? (
            <div style={{ color: '#5F6B6D', fontSize: 13 }}>هنوز نسخه‌ای ذخیره نشده است.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.items.map((rev) => (
                <button
                  key={rev.id}
                  onClick={() => openRevision(rev)}
                  style={{ display: 'block', width: '100%', textAlign: 'right', background: selected?.id === rev.id ? '#F0F9F4' : '#fff', border: `1px solid ${selected?.id === rev.id ? '#3A7D5E' : '#E4DDD2'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#263238', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rev.title}</div>
                  <div style={{ fontSize: 11, color: '#5F6B6D' }}>{fmtDate(rev.createdAt)} · {rev.savedByName ?? 'ناشناس'} · {rev.status}</div>
                </button>
              ))}
            </div>
          )}
          {data && data.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              {page > 1 && <button onClick={() => setPage(p => p - 1)} style={{ ...pillBtn, fontSize: 12 }}>قبلی</button>}
              <span style={{ fontSize: 12, color: '#5F6B6D', alignSelf: 'center' }}>{page} / {data.pages}</span>
              {page < data.pages && <button onClick={() => setPage(p => p + 1)} style={{ ...pillBtn, fontSize: 12 }}>بعدی</button>}
            </div>
          )}
          {selected && (
            <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E4DDD2', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#263238', marginBottom: 10 }}>پیش‌نمایش محتوا — {selected.title}</div>
              {content === null ? (
                <div style={{ fontSize: 12, color: '#5F6B6D' }}>در حال بارگذاری محتوا…</div>
              ) : (
                <div style={{ fontSize: 13, color: '#263238', lineHeight: 1.8, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: content }} />
              )}
            </div>
          )}
        </div>
        {canRestore && selected && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E4DDD2' }}>
            <button
              onClick={restore}
              disabled={restoring}
              style={{ ...pillBtn, width: '100%', background: '#3A7D5E', color: '#fff', padding: '12px 0', fontSize: 14, opacity: restoring ? 0.6 : 1 }}
            >
              {restoring ? '…' : `بازیابی این نسخه`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleEditor({ existing, onSave, role = 'writer' }) {
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(false);

  const [form, setForm] = useState({
    title: '', subtitle: '', summary: '', category: '', categoryName: '',
    authorId: '', authorName: '', readTime: 7,
    type: 'تحلیل عمیق', status: 'پیش‌نویس', tags: '',
    diagram: 'neural', content: '', slug: '', ...existing,
    scheduledAt: toDatetimeLocal(existing?.scheduledAt),
  });
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState({});
  const [savedForm, setSavedForm] = useState(() => JSON.stringify(form));
  const isDirty = JSON.stringify(form) !== savedForm;

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(false);
    Promise.all([adminApi.listCategories(), adminApi.listAuthors()])
      .then(([categoryItems, authorItems]) => {
        if (cancelled) return;
        const nextCats = categoryItems ?? [];
        const nextAuthors = authorItems ?? [];
        setCats(nextCats);
        setAuthors(nextAuthors);
        setForm(f => ({
          ...f,
          category: f.category || nextCats[0]?.slug || nextCats[0]?.id || '',
          categoryName: f.categoryName || nextCats[0]?.name || '',
          authorId: f.authorId || nextAuthors[0]?.id || '',
          authorName: f.authorName || nextAuthors[0]?.name || '',
        }));
      })
      .catch(() => { if (!cancelled) { setCats([]); setAuthors([]); setMetaError(true); } })
      .finally(() => { if (!cancelled) setMetaLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const insertContent = (snippet) => setForm(f => ({ ...f, content: `${f.content || ''}${snippet}` }));

  const [seoOpen, setSeoOpen] = useState(false);
  const [revisionDrawerOpen, setRevisionDrawerOpen] = useState(false);
  const [editors, setEditors] = useState([]);
  const isPublished = existing?.status === 'منتشرشده';
  const canPublishDirectly = role === 'admin' || role === 'editor';

  // Collaborative presence: heartbeat every 30s while editor is open
  useEffect(() => {
    if (!existing?.id) return;
    presenceApi.heartbeat(existing.id).catch(() => {});
    presenceApi.getEditors(existing.id).then((d) => setEditors(d.editors ?? [])).catch(() => {});
    const beat = setInterval(() => {
      presenceApi.heartbeat(existing.id).catch(() => {});
      presenceApi.getEditors(existing.id).then((d) => setEditors(d.editors ?? [])).catch(() => {});
    }, 30_000);
    return () => clearInterval(beat);
  }, [existing?.id]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isPublished && canPublishDirectly) {
          handleSaveRef.current?.('منتشرشده');
        } else {
          handleSaveRef.current?.('پیش‌نویس');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPublished, canPublishDirectly]);
  const handleSaveRef = useRef(null);

  const validate = (nextStatus = form.status) => {
    const e = {};
    if (!form.title.trim()) e.title = 'عنوان الزامی است';
    if (!form.summary.trim()) e.summary = 'خلاصه الزامی است';
    if (!form.content.trim()) e.content = 'محتوا الزامی است';
    if (!form.category) e.category = 'دسته‌بندی واقعی از API الزامی است';
    if (!form.authorId) e.authorId = 'نویسنده واقعی از API الزامی است';
    if (nextStatus === 'زمان‌بندی‌شده' && !form.scheduledAt) e.scheduledAt = 'زمان انتشار برای زمان‌بندی الزامی است';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = (status) => {
    const nextForm = { ...form, status };
    if (status === 'زمان‌بندی‌شده' && !nextForm.scheduledAt) {
      setErrors(e => ({ ...e, scheduledAt: 'زمان انتشار برای زمان‌بندی الزامی است' }));
      toast('برای زمان‌بندی، تاریخ و ساعت انتشار را وارد کنید', 'error');
      return;
    }
    if (!validate(status)) { toast('لطفاً فیلدهای الزامی را پر کنید', 'error'); return; }
    const cat = cats.find(c => c.id === form.category || c.slug === form.category);
    const author = authors.find(a => a.id === form.authorId);
    const data = {
      ...nextForm,
      scheduledAt: nextForm.scheduledAt || null,
      categoryName: cat?.name || form.categoryName,
      authorName: author?.name || form.authorName,
      slug: form.slug || form.title.replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, ''),
      tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : form.tags,
      keywords: typeof form.keywords === 'string' ? form.keywords.split(',').map(t => t.trim()).filter(Boolean) : (form.keywords ?? []),
    };
    const save = existing?.id ? adminApi.updateArticle(existing.id, data) : adminApi.createArticle(data);
    save
      .then(() => {
        setSavedForm(JSON.stringify(form));
        const msg =
          status === 'منتشرشده' ? 'مقاله منتشرشده بروزرسانی شد' :
          status === 'پیش‌نویس' ? 'پیش‌نویس ذخیره شد' :
          status === 'زمان‌بندی‌شده' ? 'مقاله زمان‌بندی شد' :
          'مقاله برای بررسی ارسال شد';
        toast(msg);
        onSave?.();
      })
      .catch((err) => {
        if (err?.body?.error === 'quality_check_failed') {
          toast(`انتشار متوقف شد: ${err.body.issues?.join('، ')}`, 'error');
        } else {
          toast('خطا در ذخیره مقاله', 'error');
        }
      });
  };
  handleSaveRef.current = handleSave;

  const field = (label, key, type = 'text', options = null) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#5F6B6D', display: 'block', marginBottom: 6 }}>{label}</label>
      {options ? (
        <select value={form[key]} onChange={e => set(key, e.target.value)} style={{ ...inputStyle }} dir="rtl">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={form[key]} onChange={e => set(key, e.target.value)} rows={key === 'content' ? 14 : 3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.8 }} dir="rtl" />
      ) : (
        <input type={type} value={form[key]} onChange={e => set(key, type === 'number' ? +e.target.value : e.target.value)} style={{ ...inputStyle }} dir="rtl" />
      )}
      {errors[key] && <div style={{ fontSize: 12, color: '#C94C4C', marginTop: 4 }}>{errors[key]}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: existing?.reviewNote ? 12 : 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: BRAND.primary, fontWeight: 800, marginBottom: 4 }}>جریان تولید: نوشتن → Artifact → بازبینی → انتشار</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: BRAND.ink, margin: 0, fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>
            {existing ? (isPublished ? 'ویرایش مقاله منتشرشده' : 'ویرایش مقاله') : 'مقاله جدید'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {editors.filter(e => e.userId !== undefined).length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF8F0', border: '1px solid #F5C97A', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#7A5A00' }}>
              {editors.slice(0, 4).map((ed, i) => (
                <span key={i} title={ed.name || ed.userId} style={{ width: 22, height: 22, borderRadius: '50%', background: '#E07A3A', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, marginLeft: -6, border: '2px solid #fff' }}>
                  {(ed.name || '؟')[0]}
                </span>
              ))}
              <span style={{ marginRight: 8 }}>{editors.length} ویرایشگر آنلاین</span>
            </div>
          )}
          {existing?.id && (
            <button onClick={() => setRevisionDrawerOpen(true)} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', border: '1px solid #E4DDD2', fontSize: 12 }}>تاریخچه</button>
          )}
          <button onClick={() => setPreview(p => !p)} style={{ ...pillBtn, background: preview ? BRAND.primary : '#F4EFE6', color: preview ? '#fff' : '#263238', border: `1px solid ${preview ? BRAND.primary : BRAND.line}` }}>{preview ? 'ویرایش' : 'پیش‌نمایش'}</button>
        </div>
      </div>
      {revisionDrawerOpen && existing?.id && (
        <RevisionDrawer articleId={existing.id} canRestore={canPublishDirectly} onClose={() => setRevisionDrawerOpen(false)} onRestored={() => { setRevisionDrawerOpen(false); onSave?.(); }} />
      )}
      {existing?.reviewNote && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'linear-gradient(135deg,#FFF8F0,#FFF3E0)', border: '1px solid rgba(200,149,28,0.35)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#7A5A00', marginBottom: 3 }}>بازخورد ویراستار</div>
            <div style={{ fontSize: 13, color: '#5A4000', lineHeight: 1.8 }}>{existing.reviewNote}</div>
          </div>
        </div>
      )}
      {isPublished && !canPublishDirectly && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'linear-gradient(135deg,#EFF6FF,#E0EEFF)', border: '1px solid rgba(59,130,246,0.30)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📝</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1E3A6E', marginBottom: 3 }}>ویرایش مقاله منتشرشده</div>
            <div style={{ fontSize: 13, color: '#1E3A6E', lineHeight: 1.8 }}>تغییرات شما ابتدا پیش‌نویس ذخیره می‌شود و پس از ارسال برای بررسی، سردبیر آن را بررسی کرده و منتشر خواهد کرد.</div>
          </div>
        </div>
      )}
      {isPublished && canPublishDirectly && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>✏️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#14532D', marginBottom: 3 }}>ویرایش مستقیم مقاله منتشرشده</div>
            <div style={{ fontSize: 13, color: '#14532D', lineHeight: 1.8 }}>این مقاله هم‌اکنون منتشر است. تغییرات با کلیک «بروزرسانی و انتشار» بلافاصله در سایت اعمال می‌شود. Ctrl+S نیز همین کار را انجام می‌دهد.</div>
          </div>
        </div>
      )}

      <PanelState loading={metaLoading} error={metaError} empty={!metaLoading && !metaError && (cats.length === 0 || authors.length === 0)} emptyTitle="برای ایجاد مقاله، دسته‌بندی و نویسنده واقعی باید از API دریافت شود" />
      {!metaLoading && !metaError && cats.length > 0 && authors.length > 0 && (
      <>
      {preview ? (
        <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 32, direction: 'rtl' }}>
          <TypeBadge type={form.type} />&nbsp;<CategoryBadge name={cats.find(c => c.id === form.category || c.slug === form.category)?.name || form.categoryName || 'بدون دسته‌بندی'} color={cats.find(c => c.id === form.category || c.slug === form.category)?.color} />
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263238', margin: '16px 0 8px', lineHeight: 1.4 }}>{form.title || 'عنوان مقاله'}</h1>
          {form.subtitle && <p style={{ fontSize: 18, color: '#5F6B6D', margin: '0 0 8px', lineHeight: 1.6, fontWeight: 500 }}>{form.subtitle}</p>}
          <p style={{ fontSize: 16, color: '#5F6B6D', margin: '0 0 24px', lineHeight: 1.7 }}>{form.summary}</p>
          {form.diagram && (
            <div style={{ background: '#F4F0EA', borderRadius: 12, padding: '20px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DiagramRenderer type={form.diagram} />
            </div>
          )}
          <div style={{ fontSize: 16, lineHeight: 2, color: '#263238' }} dangerouslySetInnerHTML={{ __html: form.content }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 24, alignItems: 'start' }} className="editor-grid">
          <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 22, boxShadow: '0 10px 34px rgba(15,42,46,0.05)' }}>
            {/* Basic info group */}
            <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.primary, letterSpacing: '0.08em', marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${BRAND.line}` }}>
              اطلاعات پایه
            </div>
            {field('عنوان', 'title')}
            {field('زیرعنوان', 'subtitle')}
            {field('خلاصه', 'summary', 'textarea')}
            {field('دسته‌بندی', 'category', 'text', cats.map(c => ({ v: c.slug || c.id, l: c.name })))}
            {field('نویسنده', 'authorId', 'text', authors.map(a => ({ v: a.id, l: a.name })))}
            {field('نوع محتوا', 'type', 'text', ['تحلیل عمیق', 'راهنمای فنی', 'داده‌نما', 'پژوهش', 'پرونده', 'خبر فوری'].map(t => ({ v: t, l: t })))}
            {field('زمان مطالعه (دقیقه)', 'readTime', 'number')}
            {field('برچسب‌ها (با کاما جدا کنید)', 'tags')}

            {/* Flags group */}
            <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.primary, letterSpacing: '0.08em', margin: '20px 0 14px', paddingBottom: 8, borderBottom: `1px solid ${BRAND.line}` }}>
              نشانه‌گذاری
            </div>
            {[
              { key: 'premiumOnly', label: 'فقط اعضای ویژه', icon: '🔒' },
              { key: 'sponsored', label: 'محتوای حمایت‌شده', icon: '⭐' },
              { key: 'featured', label: 'مقاله ویژه', icon: '★' },
            ].map(({ key, label, icon }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#263238', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span>{label}</span>
                </label>
                <button
                  type="button"
                  onClick={() => set(key, !form[key])}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: form[key] ? BRAND.primary : '#D0CCC5',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                  aria-pressed={!!form[key]}
                >
                  <span style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'inset-inline-start 0.2s',
                    insetInlineStart: form[key] ? 23 : 3,
                  }} />
                </button>
              </div>
            ))}

            {/* Scheduling group */}
            <div style={{ fontSize: 11, fontWeight: 800, color: BRAND.primary, letterSpacing: '0.08em', margin: '20px 0 14px', paddingBottom: 8, borderBottom: `1px solid ${BRAND.line}` }}>
              زمان‌بندی
            </div>
            {field('زمان انتشار زمان‌بندی‌شده', 'scheduledAt', 'datetime-local')}

            {/* SEO group — collapsible */}
            <button
              type="button"
              onClick={() => setSeoOpen(o => !o)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Vazirmatn,sans-serif', marginBottom: 2 }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, color: BRAND.primary, letterSpacing: '0.08em' }}>سئو پیشرفته</span>
              <span style={{ fontSize: 11, color: BRAND.muted, borderBottom: `1px solid ${BRAND.line}`, width: '75%', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: BRAND.primary, marginRight: 6 }}>{seoOpen ? '▴' : '▾'}</span>
            </button>
            {seoOpen && (
              <div style={{ paddingTop: 4 }}>
                {field('آدرس مقاله (slug)', 'slug')}
                {field('متا دسکریپشن', 'metaDescription', 'textarea')}
                {field('کلیدواژه‌ها (با کاما)', 'keywords')}
                {field('عنوان Open Graph', 'ogTitle')}
                {field('توضیح Open Graph', 'ogDescription', 'textarea')}
                {field('تصویر Open Graph', 'ogImage')}
                {field('مسیر canonical', 'canonicalPath')}
              </div>
            )}
          </div>
          <div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#5F6B6D', display: 'block', marginBottom: 6 }}>محتوای مقاله</label>
              <HtmlEditor value={form.content} onChange={v => set('content', v)} />
              {errors.content && <div style={{ fontSize: 12, color: '#C94C4C', marginTop: 4 }}>{errors.content}</div>}
            </div>
            <ArtifactStudio
              selectedDiagram={form.diagram}
              onSelectDiagram={(diagram) => set('diagram', diagram)}
              onInsert={insertContent}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {isPublished && canPublishDirectly ? (
          <>
            <button onClick={() => handleSave('منتشرشده')} style={{ ...pillBtn, background: '#2F8F6B', color: '#fff', padding: '10px 24px' }}>بروزرسانی و انتشار</button>
            <button onClick={() => handleSave('پیش‌نویس')} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', border: '1px solid #E4DDD2', padding: '10px 24px' }}>تبدیل به پیش‌نویس</button>
            <button onClick={() => handleSave('زمان‌بندی‌شده')} style={{ ...pillBtn, background: '#D49A2A', color: '#fff', padding: '10px 24px' }}>زمان‌بندی مجدد</button>
          </>
        ) : isPublished ? (
          <>
            <button onClick={() => handleSave('پیش‌نویس')} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', border: '1px solid #E4DDD2', padding: '10px 24px' }}>ذخیره پیش‌نویس</button>
            <button onClick={() => handleSave('در انتظار بررسی')} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', padding: '10px 24px' }}>ارسال برای بررسی مجدد</button>
          </>
        ) : (
          <>
            <button onClick={() => handleSave('پیش‌نویس')} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', border: '1px solid #E4DDD2', padding: '10px 24px' }}>ذخیره پیش‌نویس</button>
            <button onClick={() => handleSave('در انتظار بررسی')} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', padding: '10px 24px' }}>ارسال برای بررسی</button>
            <button onClick={() => handleSave('زمان‌بندی‌شده')} style={{ ...pillBtn, background: '#D49A2A', color: '#fff', padding: '10px 24px' }}>زمان‌بندی انتشار</button>
          </>
        )}
        {onSave && <button onClick={onSave} style={{ ...pillBtn, background: '#F4EFE6', color: '#5F6B6D', padding: '10px 24px' }}>انصراف</button>}
        {isDirty && (
          <span style={{ fontSize: 11, color: '#C94C4C', fontWeight: 700, marginInlineStart: 4 }}>
            ● ذخیره نشده · Ctrl+S
          </span>
        )}
      </div>
      </>
      )}
      <style>{`
        .editor-grid { grid-template-columns: 0.9fr 1.1fr; }
        .artifact-grid { grid-template-columns: 1.1fr 0.9fr; }
        .artifact-filters { grid-template-columns: 1fr 170px; }
        @media(max-width:980px){
          .editor-grid, .artifact-grid, .artifact-filters { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ── User Management ─────────────────────────────────────────────────────────
function UserManagement() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const refresh = () => {
    setLoading(true);
    setError(false);
    return adminApi.listUsers()
      .then(items => setUsers(items ?? []))
      .catch(() => { setUsers([]); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (search) { const q = search.toLowerCase(); list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)); }
    if (roleFilter) list = list.filter(u => u.role === roleFilter);
    return list;
  }, [users, search, roleFilter]);

  const toggleStatus = async (id, status) => {
    try {
      await adminApi.updateUser(id, { status: status === 'active' ? 'suspended' : 'active' });
      toast('وضعیت کاربر تغییر کرد');
      refresh();
    } catch {
      toast('خطا در تغییر وضعیت کاربر', 'error');
    }
  };
  const changeRole = async (id, role) => {
    try {
      await adminApi.updateUser(id, { role });
      toast('نقش کاربر تغییر کرد');
      refresh();
    } catch {
      toast('خطا در تغییر نقش کاربر', 'error');
    }
  };

  return (
    <div>
      {selectedUser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setSelectedUser(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'relative', background: '#FAF7F0', borderRadius: 14, padding: 32, maxWidth: 420, width: '90%', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#263238' }}>جزئیات کاربر</h3>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <AuthorAvatar author={{ initials: selectedUser.name.slice(0, 2), color: '#0F6B73' }} size={60} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#263238' }}>{selectedUser.name}</div>
                <div style={{ fontSize: 13, color: '#5F6B6D', direction: 'ltr' }}>{selectedUser.email}</div>
                <div style={{ marginTop: 6 }}><RoleBadge role={selectedUser.role} /></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[['مقاله‌ها', selectedUser.articleCount ?? '—'], ['تاریخ عضویت', selectedUser.joinDate], ['وضعیت', selectedUser.status === 'active' ? 'فعال' : 'غیرفعال']].map(([l, v]) => (
                <div key={l} style={{ background: '#F4EFE6', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#5F6B6D' }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#263238' }}>{v}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedUser(null)} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', width: '100%', justifyContent: 'center' }}>بستن</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی کاربر..." style={{ ...inputStyle, maxWidth: 240 }} dir="rtl" />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }} dir="rtl">
          <option value="">همه نقش‌ها</option>
          {['admin', 'editor', 'writer', 'reviewer'].map(r => <option key={r} value={r}>{ADMIN_ROLE_NAMES[r]}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, direction: 'rtl' }}>
            <thead>
              <tr style={{ background: '#F4EFE6', borderBottom: '1px solid #E4DDD2' }}>
                {['نام', 'ایمیل', 'نقش', 'وضعیت', 'مقاله‌ها', 'اقدام'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'right', color: '#5F6B6D', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #E4DDD2', background: i % 2 === 0 ? '#fff' : '#FDFBF7' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AuthorAvatar author={{ initials: u.name.slice(0, 2), color: '#0F6B73' }} size={32} />
                      <span style={{ fontWeight: 600, color: '#263238' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', direction: 'ltr', color: '#5F6B6D', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{ border: '1px solid #E4DDD2', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif', background: '#fff' }} dir="rtl">
                      {['admin', 'editor', 'writer', 'reviewer'].map(r => <option key={r} value={r}>{ADMIN_ROLE_NAMES[r]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: u.status === 'active' ? '#2F8F6B' : '#C94C4C' }}>{u.status === 'active' ? 'فعال' : 'غیرفعال'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#5F6B6D' }}>{u.articleCount ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setSelectedUser(u)} style={{ ...actionBtn, background: '#0F6B7318', color: '#0F6B73' }}>جزئیات</button>
                      <button onClick={() => toggleStatus(u.id, u.status)} style={{ ...actionBtn, background: u.status === 'active' ? '#C94C4C18' : '#2F8F6B18', color: u.status === 'active' ? '#C94C4C' : '#2F8F6B' }}>
                        {u.status === 'active' ? 'غیرفعال' : 'فعال'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PanelState loading={loading} error={error} empty={!loading && !error && users.length === 0} emptyTitle="هنوز کاربری از API دریافت نشده است" />
        {!loading && !error && users.length > 0 && filtered.length === 0 && <EmptyState title="موردی مطابق فیلترها یافت نشد" />}
      </div>
    </div>
  );
}

// ── Category Management ─────────────────────────────────────────────────────
function CategoryManagement() {
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#0F6B73' });
  const [confirm, setConfirm] = useState(null);

  const refresh = () => {
    setLoading(true);
    setError(false);
    return adminApi.listCategories()
      .then(items => setCats(items ?? []))
      .catch(() => { setCats([]); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);
  const addCat = async () => {
    if (!form.name.trim()) { toast('نام دسته‌بندی الزامی است', 'error'); return; }
    try {
      await adminApi.createCategory({ ...form, slug: form.name.replace(/\s+/g, '-'), diagram: 'neural' });
      toast('دسته‌بندی اضافه شد'); setForm({ name: '', description: '', color: '#0F6B73' }); refresh();
    } catch {
      toast('خطا در افزودن دسته‌بندی', 'error');
    }
  };
  const del = async (id) => {
    try {
      await adminApi.deleteCategory(id);
      toast('دسته‌بندی حذف شد'); refresh();
    } catch {
      toast('خطا در حذف دسته‌بندی', 'error');
    }
    setConfirm(null);
  };

  return (
    <div>
      {confirm && <ConfirmModal msg="آیا از حذف این دسته‌بندی اطمینان دارید؟" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#263238', direction: 'rtl' }}>افزودن دسته‌بندی جدید</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', direction: 'rtl' }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="نام دسته‌بندی" style={{ ...inputStyle, maxWidth: 200 }} dir="rtl" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="توضیحات" style={{ ...inputStyle, flex: 1, minWidth: 200 }} dir="rtl" />
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: 48, height: 40, border: '1px solid #E4DDD2', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
          <button onClick={addCat} style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>افزودن</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
        {cats.map(c => (
          <div key={c.id} style={{ background: '#fff', border: `1px solid ${c.color}30`, borderRadius: 10, padding: '16px 18px', borderRight: `4px solid ${c.color}`, direction: 'rtl', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#263238' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>{c.articleCount} مقاله</div>
            </div>
            <button onClick={() => setConfirm(c.dbId || c.id)} style={{ ...actionBtn, background: '#C94C4C18', color: '#C94C4C' }}>حذف</button>
          </div>
        ))}
      </div>
      <PanelState loading={loading} error={error} empty={!loading && !error && cats.length === 0} emptyTitle="هنوز دسته‌بندی‌ای در بک‌اند ثبت نشده است" />
    </div>
  );
}

// ── Tags Management ─────────────────────────────────────────────────────────
function TagsManagement() {
  const toast = useToast();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState('');

  const refresh = () => {
    setLoading(true);
    setError(false);
    return adminApi.listTags()
      .then(items => setTags(items ?? []))
      .catch(() => { setTags([]); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);
  const addTag = async () => {
    if (!newTag.trim()) return;
    try {
      await adminApi.createTag(newTag);
      toast('برچسب اضافه شد'); setNewTag(''); refresh();
    } catch {
      toast('خطا در افزودن برچسب', 'error');
    }
  };
  const del = async (id) => {
    try {
      await adminApi.deleteTag(id);
      toast('برچسب حذف شد'); refresh();
    } catch {
      toast('خطا در حذف برچسب', 'error');
    }
    setConfirm(null);
  };

  const filtered = search ? tags.filter(t => t.name.includes(search)) : tags;

  return (
    <div>
      {confirm && <ConfirmModal msg="آیا از حذف این برچسب اطمینان دارید؟" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, direction: 'rtl', flexWrap: 'wrap' }}>
        <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="برچسب جدید..." style={{ ...inputStyle, maxWidth: 220 }} dir="rtl" />
        <button onClick={addTag} style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>افزودن</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی برچسب..." style={{ ...inputStyle, maxWidth: 200 }} dir="rtl" />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {filtered.map(t => (
          <div key={t.id} style={{ background: '#F4EFE6', border: '1px solid #E4DDD2', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, direction: 'rtl' }}>
            <span style={{ fontSize: 13, color: '#263238' }}>{t.name}</span>
            <span style={{ fontSize: 11, color: '#5F6B6D' }}>({t.count})</span>
            <button onClick={() => setConfirm(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C94C4C', fontSize: 14, padding: 0 }}>✕</button>
          </div>
        ))}
      </div>
      <PanelState loading={loading} error={error} empty={!loading && !error && tags.length === 0} emptyTitle="هنوز برچسبی در بک‌اند ثبت نشده است" />
      {!loading && !error && tags.length > 0 && filtered.length === 0 && <EmptyState title="موردی مطابق جستجو یافت نشد" />}
    </div>
  );
}

// ── Authors Management ──────────────────────────────────────────────────────
function AuthorsManagement() {
  const toast = useToast();
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', specialty: '', bio: '', initials: '', color: '#0F6B73', social: {} });
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const refresh = () => {
    setLoading(true);
    setError(false);
    return adminApi.listAuthors()
      .then(items => setAuthors(items ?? []))
      .catch(() => { setAuthors([]); setError(true); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.specialty.trim()) {
      toast('نام، نام مستعار و تخصص الزامی است', 'error');
      return;
    }
    try {
      if (editing) {
        await adminApi.updateAuthor(editing, form);
        toast('نویسنده ویرایش شد');
      } else {
        await adminApi.createAuthor(form);
        toast('نویسنده اضافه شد');
      }
      setForm({ name: '', slug: '', specialty: '', bio: '', initials: '', color: '#0F6B73', social: {} });
      setEditing(null);
      refresh();
    } catch {
      toast('خطا در ذخیره نویسنده', 'error');
    }
  };

  const del = async (id) => {
    try {
      await adminApi.deleteAuthor(id);
      toast('نویسنده حذف شد');
      refresh();
    } catch {
      toast('خطا در حذف نویسنده', 'error');
    }
    setConfirm(null);
  };

  const edit = (author) => {
    setForm({
      name: author.name,
      slug: author.slug,
      specialty: author.specialty,
      bio: author.bio || '',
      initials: author.initials || '',
      color: author.color || '#0F6B73',
      social: author.social || {},
    });
    setEditing(author.id);
  };

  const cancel = () => {
    setForm({ name: '', slug: '', specialty: '', bio: '', initials: '', color: '#0F6B73', social: {} });
    setEditing(null);
  };

  return (
    <div>
      {confirm && <ConfirmModal msg="آیا از حذف این نویسنده اطمینان دارید؟" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />}
      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#263238', direction: 'rtl' }}>
          {editing ? 'ویرایش نویسنده' : 'افزودن نویسنده جدید'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, direction: 'rtl' }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="نام نویسنده *" style={inputStyle} dir="rtl" />
          <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="نام مستعار (slug) *" style={inputStyle} dir="rtl" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12, direction: 'rtl' }}>
          <input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="تخصص *" style={inputStyle} dir="rtl" />
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={form.initials} onChange={e => setForm(f => ({ ...f, initials: e.target.value }))} placeholder="حروف اول" style={{ ...inputStyle, flex: 1 }} dir="rtl" maxLength={3} />
            <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: 48, height: 40, border: '1px solid #E4DDD2', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
          </div>
        </div>
        <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="بیوگرافی" style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'Vazirmatn,sans-serif' }} dir="rtl" />
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={save} style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>
            {editing ? 'ذخیره تغییرات' : 'افزودن'}
          </button>
          {editing && <button onClick={cancel} style={{ ...pillBtn, background: '#5F6B6D18', color: '#5F6B6D' }}>انصراف</button>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
        {authors.map(a => (
          <div key={a.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20, direction: 'rtl', borderRight: `4px solid ${a.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${a.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: a.color }}>
                {a.initials || a.name.slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#263238' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>{a.specialty}</div>
              </div>
            </div>
            {a.bio && <div style={{ fontSize: 12, color: '#5F6B6D', marginBottom: 12, lineHeight: 1.6 }}>{a.bio}</div>}
            <div style={{ fontSize: 11, color: '#5F6B6D', marginBottom: 12 }}>
              {a.articleCount || 0} مقاله • slug: {a.slug}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => edit(a)} style={{ ...actionBtn, background: '#0F6B7318', color: '#0F6B73' }}>ویرایش</button>
              <button onClick={() => setConfirm(a.id)} style={{ ...actionBtn, background: '#C94C4C18', color: '#C94C4C' }}>حذف</button>
            </div>
          </div>
        ))}
      </div>
      <PanelState loading={loading} error={error} empty={!loading && !error && authors.length === 0} emptyTitle="هنوز نویسنده‌ای در بک‌اند ثبت نشده است" />
    </div>
  );
}

// ── Media Library ───────────────────────────────────────────────────────────
function MediaLibrary({ role }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    return adminApi.listMedia({ q: query, mimeType, limit: 60 })
      .then(res => setItems(res.items ?? []))
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }, [query, mimeType]);

  useEffect(() => { refresh(); }, [refresh]);

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('آدرس رسانه کپی شد');
    } catch {
      toast('کپی آدرس رسانه ناموفق بود', 'error');
    }
  };

  const deleteMedia = async (id) => {
    try {
      await adminApi.deleteMedia(id);
      toast('رسانه حذف شد');
      refresh();
    } catch (e) {
      toast(e.body?.error === 'media_in_use' ? 'این رسانه در محتوا یا پروفایل استفاده شده است' : 'حذف رسانه ناموفق بود', 'error');
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div>
      {confirm && <ConfirmModal msg="آیا از حذف این رسانه مطمئن هستید؟" onConfirm={() => deleteMedia(confirm)} onCancel={() => setConfirm(null)} />}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجوی نام فایل..." style={{ ...inputStyle, maxWidth: 260 }} dir="rtl" />
        <select value={mimeType} onChange={e => setMimeType(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }} dir="rtl">
          <option value="">همه فایل‌ها</option>
          <option value="image/">تصویرها</option>
          <option value="image/webp">WebP</option>
          <option value="image/png">PNG</option>
          <option value="image/jpeg">JPEG</option>
        </select>
      </div>
      <PanelState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="هنوز رسانه‌ای در بک‌اند ثبت نشده است" />
      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {items.map(item => (
            <div key={item.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, overflow: 'hidden', direction: 'rtl' }}>
              <div style={{ height: 138, background: '#F4EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {item.mimeType?.startsWith('image/')
                  ? <img src={item.url} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  : <span style={{ color: '#5F6B6D', fontSize: 13 }}>{item.mimeType}</span>}
              </div>
              <div style={{ padding: 14 }}>
                <div title={item.filename} style={{ fontSize: 13, fontWeight: 700, color: '#263238', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.filename}</div>
                <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 6 }}>
                  {item.sizeBytes ? `${Math.round(item.sizeBytes / 1024).toLocaleString('fa-IR')} KB` : 'اندازه نامشخص'}
                  {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => copyUrl(item.url)} style={{ ...actionBtn, background: '#0F6B7318', color: '#0F6B73' }}>کپی URL</button>
                  {role === 'admin' && <button onClick={() => setConfirm(item.id)} style={{ ...actionBtn, background: '#C94C4C18', color: '#C94C4C' }}>حذف</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity Log ────────────────────────────────────────────────────────────
const SEO_SEVERITY = { error: { label: 'خطا', color: '#C94C4C', bg: '#FEF2F2' }, warning: { label: 'هشدار', color: '#C8951C', bg: '#FFFBEB' }, info: { label: 'پیشنهاد', color: '#0F6B73', bg: '#F0FDFA' } };

function SeoAuditPanel() {
  const { navigate } = useNav();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setLoading(true);
    setError(false);
    adminApi.getSeoAudit()
      .then(setAudit)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading || error || !audit) return <PanelState loading={loading} error={error} empty={!loading && !error} emptyTitle="داده ممیزی از سرور دریافت نشد" />;

  const issues = (audit.items ?? []).filter(item => item.missing?.length || item.needsRefresh);
  const totalIssues = issues.reduce((sum, item) => sum + (item.missing?.length ?? 0) + (item.needsRefresh ? 1 : 0), 0);
  const pageItems = issues.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(issues.length / PAGE_SIZE);

  const getSeverity = (key) => {
    if (['metaDescription', 'ogTitle', 'ogDescription'].includes(key)) return 'error';
    if (['keywords', 'ogImage', 'canonicalPath'].includes(key)) return 'warning';
    return 'info';
  };

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, color: BRAND.ink }}>
          {totalIssues.toLocaleString('fa-IR')} مشکل یافت شد در {issues.length.toLocaleString('fa-IR')} مقاله
        </div>
        {issues.length === 0 && <span style={{ color: '#2F8F6B', fontWeight: 700, fontSize: 14 }}>✓ همه مقاله‌ها سالم هستند</span>}
      </div>
      {issues.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Vazirmatn,sans-serif' }}>
            <thead>
              <tr style={{ background: '#F4EFE6', borderBottom: '1px solid #E4DDD2' }}>
                {['مقاله', 'مشکلات', 'شدت'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'right', color: '#5F6B6D', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
                const allKeys = [...(item.missing ?? []), ...(item.needsRefresh ? ['needsRefresh'] : [])];
                const worstSeverity = allKeys.some(k => getSeverity(k) === 'error') ? 'error' : allKeys.some(k => getSeverity(k) === 'warning') ? 'warning' : 'info';
                const sev = SEO_SEVERITY[worstSeverity];
                return (
                  <tr key={item.article.id} style={{ borderBottom: '1px solid #E4DDD2', background: i % 2 === 0 ? '#fff' : '#FDFBF7' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => navigate('/article/' + item.article.slug)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: BRAND.primary, fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                        {item.article.title}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {allKeys.map(k => {
                          const s = SEO_SEVERITY[getSeverity(k)];
                          return <span key={k} style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{k}</span>;
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.color}33`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{sev.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 16, borderTop: '1px solid #E4DDD2' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', opacity: page === 0 ? 0.5 : 1 }}>قبلی</button>
              <span style={{ fontSize: 13, color: '#5F6B6D', alignSelf: 'center' }}>صفحه {(page + 1).toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ ...pillBtn, background: '#F4EFE6', color: '#263238', opacity: page >= totalPages - 1 ? 0.5 : 1 }}>بعدی</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentsModeration() {
  const toast = useToast();
  const { navigate } = useNav();
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    setSelected(new Set());
    return adminApi.listComments({ flagged: flaggedOnly, limit: 50 })
      .then(res => setItems(res.items ?? []))
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }, [flaggedOnly]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)));

  const remove = async (id) => {
    try {
      await adminApi.deleteComment(id);
      toast('نظر حذف شد');
      refresh();
    } catch {
      toast('حذف نظر ناموفق بود', 'error');
    }
  };

  const unflag = async (id) => {
    try {
      await adminApi.unflagComment(id);
      toast('گزارش‌های نظر پاک شد');
      refresh();
    } catch {
      toast('پاک کردن گزارش‌ها ناموفق بود', 'error');
    }
  };

  const bulkAction = async (action) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await adminApi.bulkModerateComments(ids, action);
      toast(`${ids.length.toLocaleString('fa-IR')} نظر ${action === 'delete' ? 'حذف شد' : action === 'approve' ? 'تأیید شد' : 'علامت‌گذاری شد'}`);
      refresh();
    } catch {
      toast('عملیات دسته‌ای ناموفق بود', 'error');
    }
  };

  const bulkDeleteFlagged = async () => {
    if (!window.confirm('همه نظرهای گزارش‌شده حذف شوند؟')) return;
    try {
      const res = await adminApi.deleteFlaggedComments();
      toast(`${(res?.deleted ?? 0).toLocaleString('fa-IR')} نظر حذف شد`);
      refresh();
    } catch {
      toast('حذف دسته‌ای ناموفق بود', 'error');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: BRAND.ink }}>
          <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
          فقط گزارش‌شده
        </label>
        {flaggedOnly && items.length > 0 && (
          <button onClick={bulkDeleteFlagged} style={{ ...actionBtn, background: '#C94C4C', color: '#fff', fontSize: 12 }}>
            حذف همه گزارش‌شده
          </button>
        )}
      </div>
      <PanelState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="هنوز نظری برای نمایش وجود ندارد" />
      {!loading && !error && items.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5F6B6D', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} />
              انتخاب همه
            </label>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map(item => (
              <div key={item.id} style={{ background: '#fff', border: `1px solid ${selected.has(item.id) ? BRAND.primary : item.flagged ? '#C94C4C' : '#E4DDD2'}`, borderRadius: 12, padding: 16, direction: 'rtl', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} style={{ marginTop: 4, flexShrink: 0, accentColor: BRAND.primary }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink }}>{item.authorName} <span style={{ color: '#5F6B6D', fontWeight: 500 }}>@{item.authorUsername}</span></div>
                        <button onClick={() => navigate('/article/' + item.articleSlug)} style={{ background: 'none', border: 'none', padding: 0, color: BRAND.primary, cursor: 'pointer', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif' }}>{item.articleTitle}</button>
                      </div>
                      <span style={{ fontSize: 12, color: '#5F6B6D' }}>{item.time}</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.8, color: '#263238', margin: '12px 0' }}>{item.body}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: item.flagged ? '#C94C4C' : '#5F6B6D' }}>{item.flagCount.toLocaleString('fa-IR')} گزارش</span>
                      <button onClick={() => unflag(item.id)} style={{ ...actionBtn, background: '#0F6B7318', color: '#0F6B73' }}>پاک کردن گزارش</button>
                      <button onClick={() => remove(item.id)} style={{ ...actionBtn, background: '#C94C4C18', color: '#C94C4C' }}>حذف</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: BRAND.ink, color: '#fff', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontFamily: 'Vazirmatn,sans-serif', zIndex: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', direction: 'rtl', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontWeight: 700 }}>{selected.size.toLocaleString('fa-IR')} مورد انتخاب شده</span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <button onClick={() => bulkAction('delete')} style={{ background: '#C94C4C', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif', fontWeight: 700 }}>حذف</button>
          <button onClick={() => bulkAction('approve')} style={{ background: '#2F8F6B', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif', fontWeight: 700 }}>تأیید</button>
          <button onClick={() => bulkAction('flag')} style={{ background: '#D49A2A', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif', fontWeight: 700 }}>علامت‌گذاری</button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif' }}>لغو انتخاب</button>
        </div>
      )}
    </div>
  );
}

function LiveAdminFeed() {
  const [liveData, setLiveData] = useState({ count: 0, guests: 0, users: 0, commentsPerMin: 0 });
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/admin/stream', { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('visitor_update', event => {
      try {
        const parsed = JSON.parse(event.data);
        setLiveData({
          count: parsed.count || 0,
          guests: parsed.guests || 0,
          users: parsed.users || 0,
          commentsPerMin: parsed.commentsPerMin || 0
        });
      } catch {}
    });
    es.addEventListener('activity', event => setEvents(list => [JSON.parse(event.data), ...list].slice(0, 50)));
    return () => es.close();
  }, []);

  return (
    <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18, marginBottom: 20, direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <strong style={{ fontSize: 14, color: BRAND.ink }}>وضعیت زنده</strong>
        <span style={{ fontSize: 12, color: connected ? '#2F8F6B' : '#C94C4C', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#2F8F6B' : '#C94C4C', animation: connected ? 'pulseRing 2s infinite' : 'none' }} />
          {connected ? 'متصل' : 'قطع'}
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#FAF7F0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: BRAND.primary }}>{liveData.count.toLocaleString('fa-IR')}</div>
          <div style={{ fontSize: 11, color: '#5F6B6D' }}>بازدید کل</div>
        </div>
        <div style={{ background: '#FAF7F0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#2F8F6B' }}>{liveData.users.toLocaleString('fa-IR')}</div>
          <div style={{ fontSize: 11, color: '#5F6B6D' }}>کاربر لاگین‌شده</div>
        </div>
        <div style={{ background: '#FAF7F0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#D49A2A' }}>{liveData.guests.toLocaleString('fa-IR')}</div>
          <div style={{ fontSize: 11, color: '#5F6B6D' }}>مهمان</div>
        </div>
        <div style={{ background: '#FAF7F0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#C46A4D' }}>{liveData.commentsPerMin.toLocaleString('fa-IR')}</div>
          <div style={{ fontSize: 11, color: '#5F6B6D' }}>نظر بر دقیقه</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, marginBottom: 8, borderTop: '1px solid #E4DDD2', paddingTop: 16 }}>آخرین رخدادها</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.length === 0 ? <div style={{ fontSize: 12, color: '#5F6B6D' }}>هنوز رخدادی ثبت نشده...</div> : null}
        {events.slice(0, 6).map((event, idx) => (
          <div key={`${event.ts}-${idx}`} style={{ fontSize: 11, color: '#5F6B6D', background: '#F4EFE6', padding: '6px 10px', borderRadius: 6 }}>
            <span style={{ fontWeight: 600, color: BRAND.ink }}>{event.actor}</span>: {event.action || event.type} روی {event.target}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityLog() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    adminApi.listActivity({ limit: 50 })
      .then(items => { if (!cancelled) { setLog(Array.isArray(items) ? items : []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setLog([]); setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  const typeColors = { publish: '#2F8F6B', submit: '#D49A2A', draft: '#5F6B6D', approve: '#2F8F6B', reject: '#C94C4C', user: '#0F6B73', tag: '#C76D4A', category: '#D49A2A', edit: '#0F6B73', role: '#C76D4A', delete: '#C94C4C', author: '#C76D4A', upload: '#2F8F6B', media: '#C46A4D', schedule: '#D49A2A' };
  if (loading) return <div style={{ color: '#5F6B6D', fontSize: 13, padding: '20px 0', direction: 'rtl' }}>در حال بارگذاری...</div>;
  if (error) return <EmptyState title="اتصال به API فعالیت‌ها برقرار نشد" subtitle="فعالیت نمونه نمایش داده نمی‌شود." />;
  if (log.length === 0) return <div style={{ color: '#5F6B6D', fontSize: 13, padding: '20px 0', direction: 'rtl' }}>هنوز فعالیتی ثبت نشده است.</div>;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <a href={adminApi.activityExportUrl({ limit: 5000 })} style={{ ...pillBtn, background: '#0F6B7318', color: '#0F6B73', textDecoration: 'none', fontSize: 12 }}>خروجی CSV</a>
      </div>
      {log.slice(0, 20).map(item => (
        <div key={item.id} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid #E4DDD2', direction: 'rtl', alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColors[item.type] || '#5F6B6D', marginTop: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: '#263238', fontSize: 13 }}>{typeof item.user === 'string' ? item.user : (item.user?.name ?? 'کاربر')}</span>
            <span style={{ color: '#5F6B6D', fontSize: 13 }}> — {item.action}: </span>
            <span style={{ color: '#0F6B73', fontSize: 13 }}>{item.target}</span>
          </div>
          <span style={{ fontSize: 11, color: '#5F6B6D', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {item.time || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('fa-IR') : '')}
          </span>
        </div>
      ))}
    </div>
  );
}

function DashboardCategoryStats() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    adminApi.listCategories()
      .then(items => { if (!cancelled) setCats(items ?? []); })
      .catch(() => { if (!cancelled) { setCats([]); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || error || cats.length === 0) {
    return <PanelState loading={loading} error={error} empty={!loading && !error && cats.length === 0} emptyTitle="هنوز آمار دسته‌بندی از API دریافت نشده است" />;
  }

  return cats.map(c => (
    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #E4DDD2' }}>
      <span style={{ fontSize: 13, color: '#263238' }}>{c.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: Math.max((c.articleCount || 0) * 2, 20), height: 6, background: c.color || BRAND.primary, borderRadius: 3, opacity: 0.7 }} />
        <span style={{ fontSize: 12, color: '#5F6B6D' }}>{c.articleCount ?? 0}</span>
      </div>
    </div>
  ));
}

function DashboardTopArticles() {
  const { navigate } = useNav();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    adminApi.getDashboard()
      .then(res => { if (!cancelled) setItems(res?.topArticles ?? []); })
      .catch(() => { if (!cancelled) { setItems([]); setError(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || error || items.length === 0) {
    return <PanelState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="هنوز مقاله‌ای برای رتبه‌بندی بازدید وجود ندارد" />;
  }

  return items.map(article => (
    <button key={article.id} onClick={() => navigate('/article/' + article.slug)} style={{ width: '100%', border: 'none', background: 'transparent', borderBottom: '1px solid #E4DDD2', padding: '10px 0', textAlign: 'right', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#263238', lineHeight: 1.6 }}>{article.title}</div>
      <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>{(article.views ?? 0).toLocaleString('fa-IR')} بازدید · {article.status}</div>
    </button>
  ));
}

// ── Admin Panel (main) ──────────────────────────────────────────────────────
function EngagementAnalyticsPanel() {
  const [engagement, setEngagement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    adminApi.getEngagementAnalytics()
      .then(setEngagement)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading || error || !engagement) return <PanelState loading={loading} error={error} empty={!loading && !error} emptyTitle="هنوز داده تعامل از API دریافت نشده است" />;

  const byType = engagement.byType ?? [];
  const totalEvents = byType.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
  const topArticles = (engagement.topArticles ?? []).slice(0, 5);
  const weeklyData = engagement.weeklyData ?? [];

  const barMax = Math.max(...weeklyData.map(d => d.count ?? 0), 1);

  return (
    <div style={{ display: 'grid', gap: 18, direction: 'rtl' }}>
      {weeklyData.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: BRAND.ink }}>رویدادهای ۷ روز گذشته</h3>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100 }}>
            {weeklyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: '#5F6B6D' }}>{Number(d.count ?? 0).toLocaleString('fa-IR')}</div>
                <div style={{ width: '100%', background: BRAND.primary, borderRadius: '4px 4px 0 0', height: `${Math.round((d.count ?? 0) / barMax * 70)}px`, minHeight: 2 }} />
                <div style={{ fontSize: 9, color: '#5F6B6D', transform: 'rotate(-35deg)', transformOrigin: 'center', whiteSpace: 'nowrap' }}>{d.date ?? ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, color: BRAND.ink }}>انواع رویداد</h3>
        {byType.length === 0 ? <EmptyState title="هنوز رویدادی ثبت نشده است" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Vazirmatn,sans-serif' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E4DDD2' }}>
                {['نوع رویداد', 'تعداد', 'درصد'].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: '#5F6B6D', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {byType.map(item => (
                <tr key={item.type} style={{ borderBottom: '1px solid #E4DDD2' }}>
                  <td style={{ padding: '8px 12px', color: BRAND.ink, fontWeight: 600 }}>{item.type}</td>
                  <td style={{ padding: '8px 12px', color: '#263238' }}>{Number(item.count ?? 0).toLocaleString('fa-IR')}</td>
                  <td style={{ padding: '8px 12px', color: '#5F6B6D' }}>
                    {totalEvents > 0 ? `${Math.round(Number(item.count ?? 0) / totalEvents * 100)}٪` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {topArticles.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: BRAND.ink }}>۵ مقاله برتر بر اساس تعامل</h3>
          {topArticles.map((article, i) => (
            <div key={article.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #E4DDD2' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink }}>{article.title}</span>
              <span style={{ fontSize: 12, color: '#5F6B6D', whiteSpace: 'nowrap' }}>{Number(article.eventCount ?? 0).toLocaleString('fa-IR')} رویداد</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Phase9AnalyticsPanel() {
  const [subTab, setSubTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    adminApi.getAnalytics()
      .then(analytics => { if (!cancelled) setData(analytics); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const tabs = [
    { id: 'overview', label: 'مروری' },
    { id: 'engagement', label: 'تعامل' },
  ];

  const tabBtn = (id) => ({
    background: subTab === id ? BRAND.primary : 'transparent',
    color: subTab === id ? '#fff' : '#5F6B6D',
    border: `1px solid ${subTab === id ? BRAND.primary : '#E4DDD2'}`,
    borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif', transition: 'all 0.15s',
  });

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(t => <button key={t.id} style={tabBtn(t.id)} onClick={() => setSubTab(t.id)}>{t.label}</button>)}
      </div>

      {subTab === 'engagement' ? <EngagementAnalyticsPanel /> : (
        <>
          {(loading || error || !data) ? <PanelState loading={loading} error={error} empty={!loading && !error} emptyTitle="هنوز داده تحلیلی از API دریافت نشده است" /> : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                {[['نظرها', data.comments], ['ذخیره‌ها', data.saved], ['مشترکان خبرنامه', data.subscribers]].map(([label, value]) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 12, color: '#5F6B6D' }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: BRAND.primary }}>{Number(value ?? 0).toLocaleString('fa-IR')}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, color: BRAND.ink }}>مقاله‌های برتر</h3>
                {(data.topArticles ?? []).length === 0 ? <EmptyState title="مقاله‌ای برای تحلیل وجود ندارد" /> : data.topArticles.map((article) => (
                  <div key={article.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #E4DDD2' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink }}>{article.title}</span>
                    <span style={{ fontSize: 12, color: '#5F6B6D' }}>{Number(article.views ?? 0).toLocaleString('fa-IR')} بازدید</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = () => adminApi.listReviews().then(setItems).catch(() => setError(true)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const update = async (articleId, status) => { await adminApi.updateReview(articleId, { status }); load(); };
  if (loading || error || items.length === 0) return <PanelState loading={loading} error={error} empty={!loading && !error && items.length === 0} emptyTitle="موردی در گردش بررسی وجود ندارد" />;
  return items.map(item => (
    <div key={item.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16, marginBottom: 12, direction: 'rtl' }}>
      <div style={{ fontWeight: 900, color: BRAND.ink, marginBottom: 4 }}>{item.article?.title}</div>
      <div style={{ fontSize: 12, color: '#5F6B6D', marginBottom: 12 }}>{item.status} · {item.reviewer?.name ?? 'بدون بازبین'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => update(item.article.id, 'approved')} style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>تأیید</button>
        <button onClick={() => update(item.article.id, 'revision_requested')} style={{ ...pillBtn, background: '#F4EFE6', color: '#C46A4D', border: '1px solid #E4DDD2' }}>نیاز به اصلاح</button>
        <button onClick={() => update(item.article.id, 'rejected')} style={{ ...pillBtn, background: '#C94C4C', color: '#fff' }}>رد</button>
      </div>
    </div>
  ));
}

function RoleMetricsPanel({ role }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    setError(false);
    return adminApi.getPanelMetrics()
      .then(setMetrics)
      .catch(() => { setMetrics(null); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    load();
    const timer = setInterval(() => { if (!cancelled) load(); }, 15000);
    let es;
    if (role === 'admin' || role === 'editor') {
      es = new EventSource('/api/admin/stream', { withCredentials: true });
      ['activity', 'view_update', 'visitor_update'].forEach((eventName) => {
        es.addEventListener(eventName, () => load());
      });
    }
    return () => { cancelled = true; clearInterval(timer); es?.close(); };
  }, [load, role]);

  if (loading || error || !metrics || metrics.statuses?.totalArticles === 0) {
    return <PanelState loading={loading} error={error} empty={!loading && !error} emptyTitle="هنوز داده‌ای برای آمار پنل ثبت نشده است" />;
  }

  const eventTotal = (metrics.realtime?.eventsByType ?? []).reduce((sum, item) => sum + Number(item.count ?? 0), 0);
  const sets = {
    admin: [
      ['مقاله منتشرشده', metrics.statuses?.published, '#2F8F6B'],
      ['در انتظار بررسی', metrics.statuses?.pending, '#D49A2A'],
      ['نیازمند اصلاح', metrics.statuses?.needsRevision, '#C94C4C'],
      ['بازدید زنده', metrics.engagement?.views, '#0F6B73'],
      ['تعامل‌ها', (metrics.engagement?.comments ?? 0) + (metrics.engagement?.saved ?? 0), '#3A7D5E'],
      ['ایراد کیفیت', metrics.quality?.recentWithIssues, '#C46A4D'],
    ],
    editor: [
      ['در انتظار تایید', metrics.statuses?.pending, '#D49A2A'],
      ['منتشرشده', metrics.statuses?.published, '#2F8F6B'],
      ['نیازمند اصلاح', metrics.statuses?.needsRevision, '#C94C4C'],
      ['مشترک خبرنامه', metrics.growth?.newsletterSubscribers, '#0F6B73'],
      ['رویدادهای زنده', eventTotal, '#3A7D5E'],
    ],
    writer: [
      ['منتشرشده', metrics.statuses?.published, '#2F8F6B'],
      ['پیش‌نویس', metrics.statuses?.drafts, '#5F6B6D'],
      ['در انتظار بررسی', metrics.statuses?.pending, '#D49A2A'],
      ['بازدید نوشته‌ها', metrics.engagement?.views, '#0F6B73'],
      ['دنبال‌کننده', metrics.engagement?.writerFollows, '#3A7D5E'],
    ],
    reviewer: [
      ['در صف بررسی', metrics.statuses?.pending, '#D49A2A'],
      ['تاییدشده', metrics.workflow?.reviewsApproved, '#2F8F6B'],
      ['نیازمند اصلاح', metrics.statuses?.needsRevision, '#C94C4C'],
      ['ایراد کیفیت اخیر', metrics.quality?.recentWithIssues, '#0F6B73'],
    ],
  };
  const stats = sets[role] ?? sets.writer;

  return (
    <div style={{ display: 'grid', gap: 14, marginBottom: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
        {stats.map(([label, value, color]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: '18px 20px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 24, fontWeight: 900, color, marginBottom: 4 }}>{Number(value ?? 0).toLocaleString('fa-IR')}</div>
            <div style={{ fontSize: 12, color: '#5F6B6D' }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16, direction: 'rtl' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>پوشش زنده پنل</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(metrics.realtime?.eventsByType ?? []).slice(0, 8).map((item) => (
            <span key={item.type} style={{ background: '#F4EFE6', border: '1px solid #E4DDD2', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: BRAND.ink }}>{item.type}: {Number(item.count ?? 0).toLocaleString('fa-IR')}</span>
          ))}
          <span style={{ background: '#F4EFE6', border: '1px solid #E4DDD2', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: BRAND.ink }}>اعلان خوانده‌نشده: {Number(metrics.realtime?.unreadNotifications ?? 0).toLocaleString('fa-IR')}</span>
        </div>
      </div>
    </div>
  );
}

function NewsletterPanel() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const load = () => Promise.all([adminApi.listNewsletterCampaigns(), adminApi.listNewsletterSubscribers()]).then(([c, s]) => { setCampaigns(c); setSubscribers(s); });
  useEffect(() => { load().catch(() => {}); }, []);
  const create = async (e) => {
    e.preventDefault();
    await adminApi.createNewsletterCampaign({ subject, bodyHtml });
    setSubject('');
    setBodyHtml('');
    toast('کمپین خبرنامه ذخیره شد');
    load();
  };
  const send = async (id) => { await adminApi.sendNewsletterCampaign(id); toast('کمپین ارسال شد'); load(); };
  return (
    <div style={{ display: 'grid', gap: 18, direction: 'rtl' }}>
      <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16 }}>مشترکان واقعی API: {subscribers.length.toLocaleString('fa-IR')}</div>
      <form onSubmit={create} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16, display: 'grid', gap: 10 }}>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="موضوع کمپین" style={inputStyle} dir="rtl" />
        <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} placeholder="HTML خبرنامه" style={{ ...inputStyle, minHeight: 140 }} dir="rtl" />
        <button style={{ ...pillBtn, background: BRAND.primary, color: '#fff', justifySelf: 'start' }}>ذخیره کمپین</button>
      </form>
      {campaigns.map(c => (
        <div key={c.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 900, color: BRAND.ink }}>{c.subject}</div>
          <div style={{ fontSize: 12, color: '#5F6B6D', margin: '6px 0 12px' }}>{c.sentAt ? `ارسال‌شده به ${c.recipientCount}` : 'آماده ارسال'}</div>
          {!c.sentAt && <button onClick={() => send(c.id)} style={{ ...pillBtn, background: BRAND.primary, color: '#fff' }}>ارسال</button>}
        </div>
      ))}
    </div>
  );
}

function SeriesManagementPanel() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const load = () => adminApi.listSeries().then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    await adminApi.createSeries({ title, description, articleIds: [] });
    setTitle('');
    setDescription('');
    toast('سری مقاله ایجاد شد');
    load();
  };
  return (
    <div style={{ display: 'grid', gap: 18, direction: 'rtl' }}>
      <form onSubmit={create} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16, display: 'grid', gap: 10 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان سری" style={inputStyle} dir="rtl" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیح کوتاه" style={{ ...inputStyle, minHeight: 80 }} dir="rtl" />
        <button style={{ ...pillBtn, background: BRAND.primary, color: '#fff', justifySelf: 'start' }}>ایجاد سری</button>
      </form>
      {items.length === 0 ? <EmptyState title="هنوز سری مقاله‌ای در API نیست" /> : items.map(s => (
        <div key={s.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 900, color: BRAND.ink }}>{s.title}</div>
          <div style={{ fontSize: 12, color: '#5F6B6D', marginTop: 4 }}>{(s.articles ?? []).length.toLocaleString('fa-IR')} مقاله · /series/{s.slug}</div>
        </div>
      ))}
    </div>
  );
}

// ── Job Listings Admin Panel ─────────────────────────────────────────────────
function JobsPanel() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const load = (status = filter) => {
    setLoading(true);
    adminApi.listJobs(status ? { status } : {}).then((data) => {
      setItems(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const moderate = async (id, status) => {
    await adminApi.moderateJob(id, { status });
    setActionMsg(`وضعیت به "${status}" تغییر یافت`);
    setTimeout(() => setActionMsg(''), 2500);
    load();
  };

  const statusLabel = { pending: 'در انتظار', approved: 'تأیید شده', rejected: 'رد شده' };
  const statusColor = { pending: '#D49A2A', approved: '#0F6B73', rejected: '#C46A4D' };

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); load(e.target.value); }} style={{ ...inputStyle, width: 160 }}>
          <option value="">همه وضعیت‌ها</option>
          <option value="pending">در انتظار</option>
          <option value="approved">تأیید شده</option>
          <option value="rejected">رد شده</option>
        </select>
        {actionMsg && <span style={{ color: '#0F6B73', fontSize: 13, fontWeight: 600 }}>{actionMsg}</span>}
      </div>
      {loading && <div style={{ color: BRAND.muted, fontSize: 14 }}>در حال بارگذاری...</div>}
      {!loading && items.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14, textAlign: 'center', padding: 40 }}>هیچ آگهی یافت نشد</div>}
      {!loading && items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F4EFE6' }}>
                {['شرکت', 'عنوان', 'موقعیت', 'وضعیت', 'تاریخ', 'عملیات'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: BRAND.ink, borderBottom: `1px solid ${BRAND.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((job) => (
                <tr key={job.id} style={{ borderBottom: `1px solid ${BRAND.line}` }}>
                  <td style={{ padding: '10px 14px' }}>{job.company}</td>
                  <td style={{ padding: '10px 14px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</td>
                  <td style={{ padding: '10px 14px' }}>{job.location}{job.remote ? ' (ریموت)' : ''}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: (statusColor[job.status] ?? '#999') + '22', color: statusColor[job.status] ?? '#999', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>
                      {statusLabel[job.status] ?? job.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: BRAND.muted }}>{new Date(job.createdAt).toLocaleDateString('fa-IR')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {job.status !== 'approved' && (
                        <button onClick={() => moderate(job.id, 'approved')} style={{ ...pillBtn, background: '#0F6B7318', color: '#0F6B73', fontSize: 11, padding: '4px 10px' }}>تأیید</button>
                      )}
                      {job.status !== 'rejected' && (
                        <button onClick={() => moderate(job.id, 'rejected')} style={{ ...pillBtn, background: '#C46A4D18', color: '#C46A4D', fontSize: 11, padding: '4px 10px' }}>رد</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Client Errors Panel ──────────────────────────────────────────────────────
function ClientErrorsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getClientErrors().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: BRAND.muted, fontSize: 14 }}>در حال بارگذاری...</div>;
  if (!data) return <div style={{ color: BRAND.muted, fontSize: 14, textAlign: 'center', padding: 40 }}>خطا در بارگذاری اطلاعات</div>;

  const maxCount = Math.max(...(data.topErrors?.map((e) => e.count) ?? [1]), 1);

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Daily sparkline */}
      {data.dailyCounts?.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, marginBottom: 12 }}>خطاها در ۳۰ روز گذشته</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
            {data.dailyCounts.slice(-30).map((d) => {
              const h = Math.max(4, Math.round((d.count / maxCount) * 56));
              return (
                <div key={d.day} title={`${d.day}: ${d.count} خطا`} style={{ flex: 1, height: h, background: '#C46A4D88', borderRadius: 2, minWidth: 4 }} />
              );
            })}
          </div>
        </div>
      )}

      {/* Top errors */}
      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, marginBottom: 12 }}>پرتکرارترین خطاها</div>
        {(data.topErrors ?? []).length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>خطایی ثبت نشده است</div>}
        {(data.topErrors ?? []).map((err, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${BRAND.line}`, padding: '8px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 12, color: BRAND.ink, flex: 1, wordBreak: 'break-all' }}>{err.message}</span>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0, fontSize: 11, color: BRAND.muted }}>
              <span style={{ color: '#C46A4D', fontWeight: 700 }}>{err.count} بار</span>
              <span>{new Date(err.lastSeen).toLocaleDateString('fa-IR')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent raw errors */}
      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, marginBottom: 12 }}>آخرین خطاهای کلاینت</div>
        {(data.recent ?? []).length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>خطایی ثبت نشده است</div>}
        {(data.recent ?? []).map((err) => (
          <div key={err.id} style={{ borderBottom: `1px solid ${BRAND.line}`, padding: '8px 0', fontSize: 12 }}>
            <div style={{ color: BRAND.ink, marginBottom: 2 }}>{err.message}</div>
            <div style={{ color: BRAND.muted, display: 'flex', gap: 12 }}>
              {err.url && <span>{err.url}</span>}
              <span>{new Date(err.createdAt).toLocaleDateString('fa-IR')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ADMIN_ROLE_NAMES = { admin: 'مدیر کل', editor: 'سردبیر', writer: 'نویسنده', reviewer: 'بازبین' };

function AdminPanel() {
  const { user, logout } = useAuth();
  const { navigate } = useNav();
  const [tab, setTab] = useState('dashboard');
  const [editingArticle, setEditingArticle] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { if (!user) navigate('/login'); }, [user]);
  if (!user) return null;

  const sectionTitle = (t) => <h2 style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink, margin: '0 0 20px', direction: 'rtl', fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}>{t}</h2>;

  const renderContent = () => {
    if (tab === 'create' || editingArticle) return (
      <ArticleEditor existing={editingArticle} role={user.role} onSave={() => { setEditingArticle(null); setTab('articles'); }} />
    );
    if (tab === 'articles') return (
      <>
        {sectionTitle(user.role === 'reviewer' ? 'مقاله‌های در انتظار بررسی' : 'مدیریت مقاله‌ها')}
        <ArticlesManagement role={user.role} onEdit={(a) => { setEditingArticle(a); setTab('edit'); }} />
      </>
    );
    if (tab === 'users' && user.role === 'admin') return <>{sectionTitle('مدیریت کاربران')}<UserManagement /></>;
    if (tab === 'authors' && (user.role === 'admin' || user.role === 'editor')) return <>{sectionTitle('مدیریت نویسندگان')}<AuthorsManagement /></>;
    if (tab === 'media' && (user.role === 'admin' || user.role === 'editor')) return <>{sectionTitle('کتابخانه رسانه')}<MediaLibrary role={user.role} /></>;
    if (tab === 'comments' && (user.role === 'admin' || user.role === 'editor')) return <>{sectionTitle('مدیریت نظرها')}<CommentsModeration /></>;
    if (tab === 'analytics') return <>{sectionTitle('تحلیل محتوا')}<Phase9AnalyticsPanel /></>;
    if (tab === 'reviews') return <>{sectionTitle('گردش بررسی مقاله‌ها')}<ReviewsPanel /></>;
    if (tab === 'newsletter' && (user.role === 'admin' || user.role === 'editor')) return <>{sectionTitle('خبرنامه')}<NewsletterPanel /></>;
    if (tab === 'series' && (user.role === 'admin' || user.role === 'editor')) return <>{sectionTitle('سری مقاله‌ها')}<SeriesManagementPanel /></>;
    if (tab === 'categories') return <>{sectionTitle('مدیریت دسته‌بندی‌ها')}<CategoryManagement /></>;
    if (tab === 'tags' && user.role === 'admin') return <>{sectionTitle('مدیریت برچسب‌ها')}<TagsManagement /></>;
    if (tab === 'seo-audit' && user.role === 'admin') return <>{sectionTitle('ممیزی SEO')}<SeoAuditPanel /></>;
    if (tab === 'jobs' && (user.role === 'admin' || user.role === 'editor')) return <>{sectionTitle('آگهی‌های شغلی')}<JobsPanel /></>;
    if (tab === 'client-errors' && user.role === 'admin') return <>{sectionTitle('خطاهای کلاینت')}<ClientErrorsPanel /></>;
    if (tab === 'activity' && user.role === 'admin') return <>{sectionTitle('گزارش فعالیت')}<ActivityLog /></>;
    return (
      <div style={{ direction: 'rtl' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#263238', margin: '0 0 6px' }}>
          خوش آمدید، {user.name}
        </h2>
        <p style={{ fontSize: 14, color: '#5F6B6D', margin: '0 0 28px' }}>نقش شما: <RoleBadge role={user.role} /></p>
        {(user.role === 'admin' || user.role === 'editor') && <LiveAdminFeed />}
        <RoleMetricsPanel role={user.role} />
        {user.role === 'admin' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="dash-grid">
            <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#263238', margin: '0 0 16px' }}>آخرین فعالیت‌ها</h3>
              <ActivityLog />
            </div>
            <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#263238', margin: '0 0 16px' }}>آمار دسته‌بندی‌ها</h3>
              <DashboardCategoryStats />
            </div>
            <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#263238', margin: '0 0 16px' }}>پربازدیدترین مقاله‌ها</h3>
              <DashboardTopArticles />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg,#FAF7F0 0%,#F3EEE4 100%)', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <AdminSidebar activeTab={tab} onTab={(t) => { setTab(t); setSidebarOpen(false); }} user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{ background: 'rgba(250,247,240,0.86)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #E4DDD2', padding: '0 28px', minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: 'rtl', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="admin-mobile-toggle" onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: '1px solid #E4DDD2', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18, color: BRAND.ink }}>☰</button>
            <div>
              <span className="admin-topbar-title" style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>پنل مدیریت تکناو</span>
              <div style={{ fontSize: 11, color: '#5F6B6D', marginTop: 2 }}>محیط تولید، بازبینی و انتشار مقاله</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTab('create')} style={{ ...pillBtn, background: BRAND.primary, color: '#fff', fontSize: 12 }}>مقاله جدید</button>
            <button onClick={() => navigate('/')} style={{ ...pillBtn, background: `${BRAND.primary}12`, color: BRAND.primary, fontSize: 12 }}>بازگشت به سایت</button>
            <button onClick={() => { logout(); navigate('/'); }} style={{ ...pillBtn, background: '#C94C4C18', color: '#C94C4C', fontSize: 12 }}>خروج</button>
          </div>
        </div>
        <div style={{ flex: 1, padding: '30px clamp(18px,3vw,38px)', overflowY: 'auto' }}>
          {renderContent()}
        </div>
      </div>
      <style>{`
        .dash-grid { grid-template-columns: 1fr 1fr; }
        @media(max-width:768px){
          .dash-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width:640px){
          .admin-sidebar { display: none !important; }
          .admin-sidebar.open { display: flex !important; position: fixed; top: 0; right: 0; bottom: 0; z-index: 300; width: 280px !important; overflow-y: auto; }
          .admin-overlay { display: block !important; }
          .admin-mobile-toggle { display: flex !important; }
          .admin-topbar-title { font-size: 12px !important; }
        }
        .admin-mobile-toggle { display: none; }
      `}</style>
    </div>
  );
}

const actionBtn = { border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'Vazirmatn,sans-serif', fontWeight: 600, whiteSpace: 'nowrap' };

// ── Writer workspace ──────────────────────────────────────────────────────────
const WW = {
  terra: '#C46A4D', terraLight: '#FAF0EB', terraBorder: 'rgba(196,106,77,0.22)',
  gold: '#C8951C', goldLight: '#FBF6E8',
  ink: '#1A2E30', muted: '#7B8C8E', faint: '#9AA5A6',
  cream: '#FAF7F0', border: '#E4DDD2',
  success: '#3A7D5E', successLight: '#EFF8F4',
  purple: '#7B5EA7', purpleLight: '#F5F0FB',
};
const wwPrimaryBtn = {
  padding: '10px 22px', borderRadius: 10, border: 'none',
  background: WW.terra, color: '#fff', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
  boxShadow: '0 3px 12px rgba(196,106,77,0.25)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const wwGhostBtn = {
  padding: '9px 16px', borderRadius: 10, border: `1px solid ${WW.border}`,
  background: '#fff', color: WW.ink, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
};
const wwDangerBtn = {
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'rgba(201,76,76,0.08)', color: '#C94C4C',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
};
const wwLinkBtn = {
  background: WW.terraLight, border: 'none', cursor: 'pointer',
  color: WW.terra, fontSize: 11, fontWeight: 700,
  fontFamily: 'Vazirmatn,sans-serif', padding: '3px 10px', borderRadius: 6,
};

const WRITING_TIPS = [
  { icon: '✦', tip: 'با یک سوال باز شروع کنید. بهترین مقاله‌ها خواننده را وارد گفتگو می‌کنند.' },
  { icon: '◈', tip: 'عنوان را آخر بنویسید. وقتی محتوا کامل است، عنوان دقیق‌تر انتخاب می‌شود.' },
  { icon: '◉', tip: 'یک مفهوم پیچیده را با یک مثال واقعی توضیح دهید تا خواننده آن را به خاطر بسپارد.' },
  { icon: '◇', tip: 'پاراگراف اول تعیین‌کننده است. اگر خواننده را نگه ندارد، ادامه را نمی‌خواند.' },
  { icon: '◎', tip: 'از اعداد استفاده کنید. \"۳ روش\" قابل اعتمادتر از \"چند روش\" به نظر می‌رسد.' },
  { icon: '✦', tip: 'مقاله را با صدای بلند بخوانید. اگر گیر کردید، جمله نیاز به بازنویسی دارد.' },
];

const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function WritingTipCard() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * WRITING_TIPS.length));
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  const advance = useCallback((step = 1) => {
    setFading(true);
    clearInterval(timerRef.current);
    setTimeout(() => {
      setIdx(i => (i + step + WRITING_TIPS.length) % WRITING_TIPS.length);
      setFading(false);
      timerRef.current = setInterval(autoAdvance, 7000);
    }, 350);
  }, []);

  function autoAdvance() { advance(1); }

  useEffect(() => {
    timerRef.current = setInterval(autoAdvance, 7000);
    return () => clearInterval(timerRef.current);
  }, []);

  const { icon, tip } = WRITING_TIPS[idx];
  return (
    <div style={{
      background: 'linear-gradient(135deg, #FAF0EB 0%, #FBF6E8 100%)',
      border: `1px solid ${WW.terraBorder}`, borderRadius: 12,
      padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(196,106,77,0.14), rgba(200,149,28,0.1))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: WW.terra,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: WW.terra, letterSpacing: '0.1em' }}>
            {'نکته نویسندگی'}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: WW.faint }}>
              {idx + 1}/{WRITING_TIPS.length}
            </span>
            <button
              type="button"
              title="نکته قبلی"
              onClick={() => advance(-1)}
              style={{ ...wwLinkBtn, padding: '2px 7px', fontSize: 13, lineHeight: 1 }}
            >‹</button>
            <button
              type="button"
              title="نکته بعدی"
              onClick={() => advance(1)}
              style={{ ...wwLinkBtn, padding: '2px 7px', fontSize: 13, lineHeight: 1 }}
            >›</button>
          </div>
        </div>
        <p style={{
          margin: 0, fontSize: 12.5, color: WW.ink, lineHeight: 1.85,
          opacity: fading ? 0 : 1,
          transform: fading ? 'translateY(4px)' : 'translateY(0)',
          transition: 'opacity 0.35s, transform 0.35s',
        }}>{tip}</p>
      </div>
    </div>
  );
}

function WeeklyChart({ data }) {
  const values = (data && data.length === 7) ? data : [2, 5, 3, 8, 4, 6, 1];
  const max = Math.max(...values, 1);
  const today = new Date().getDay();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 48, marginBottom: 6 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', borderRadius: '3px 3px 0 0',
              height: `${Math.max((v / max) * 100, 8)}%`,
              background: i === today
                ? `linear-gradient(to top, ${WW.terra}, rgba(196,106,77,0.45))`
                : 'linear-gradient(to top, #E4DDD2, #EDE9E2)',
              transition: 'height 0.5s ease',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {WEEK_DAYS.map((d, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', fontSize: 9,
            color: i === today ? WW.terra : WW.faint,
            fontWeight: i === today ? 700 : 400,
          }}>{d}</div>
        ))}
      </div>
    </div>
  );
}

function WriterAnalyticsPanel() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState(null);
  const [sparklineData, setSparklineData] = useState({});

  useEffect(() => {
    let cancelled = false;
    engagementApi.writerAnalyticsArticles()
      .then(res => { if (!cancelled) setArticles(res.items ?? []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Prefetch all sparklines once the article list is ready
  useEffect(() => {
    if (articles.length === 0) return;
    let cancelled = false;
    articles.forEach(a => {
      engagementApi.writerAnalyticsArticle(a.slug)
        .then(res => {
          if (!cancelled) setSparklineData(prev => ({ ...prev, [a.slug]: res.viewsByDay.map(d => d.views) }));
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [articles]);

  const toggleSparkline = (slug) => {
    setExpandedSlug(prev => prev === slug ? null : slug);
  };

  if (loading) return <div style={{ color: WW.muted, fontSize: 13, padding: '20px 0', direction: 'rtl' }}>در حال بارگذاری تحلیل‌ها...</div>;
  if (error) return <EmptyState title="دریافت اطلاعات تحلیلی با خطا مواجه شد" />;
  if (articles.length === 0) return <EmptyState title="مقاله‌ای برای تحلیل وجود ندارد" />;

  return (
    <section style={{ background: '#fff', border: `1px solid ${WW.border}`, borderRadius: 12, padding: 24, direction: 'rtl' }}>
      <h3 style={{ margin: '0 0 24px', fontSize: 16, color: WW.ink, fontWeight: 900 }}>عملکرد نوشته‌های من</h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Vazirmatn,sans-serif', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E4DDD2', color: WW.ink }}>
              <th style={{ padding: '12px 8px', textAlign: 'right' }}>عنوان مقاله</th>
              <th style={{ padding: '12px 8px', textAlign: 'center' }}>بازدید</th>
              <th style={{ padding: '12px 8px', textAlign: 'center' }}>واکنش</th>
              <th style={{ padding: '12px 8px', textAlign: 'center' }}>نظر</th>
              <th style={{ padding: '12px 8px', textAlign: 'center' }}>روند اخیر</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a, i) => {
              const spark = sparklineData[a.slug];
              const max = spark ? Math.max(...spark, 1) : 1;
              return (
                <React.Fragment key={a.slug}>
                  <tr style={{ background: i % 2 === 0 ? '#fff' : '#FDFBF7', borderBottom: '1px solid #E4DDD2', cursor: 'pointer' }} onClick={() => toggleSparkline(a.slug)}>
                    <td style={{ padding: '14px 8px', fontWeight: 600, color: WW.ink }}>{a.title}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'center', color: WW.muted }}>{Number(a.views || 0).toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'center', color: WW.muted }}>{Number(a.reactions || 0).toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '14px 8px', textAlign: 'center', color: WW.muted }}>{Number(a.comments || 0).toLocaleString('fa-IR')}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                      {(() => {
                        const s = sparklineData[a.slug];
                        if (!s) return <span style={{ fontSize: 10, color: WW.faint }}>...</span>;
                        if (s.length < 2) return <span style={{ fontSize: 10, color: WW.faint }}>—</span>;
                        const W = 80, H = 20;
                        const mx = Math.max(...s, 1);
                        const pts = s.map((v, si) => [
                          (si / (s.length - 1)) * W,
                          H - 2 - (v / mx) * (H - 4),
                        ]);
                        const d = pts.map(([x, y], si) => `${si === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
                        const last = pts[pts.length - 1];
                        return (
                          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'inline-block', direction: 'ltr', verticalAlign: 'middle' }}>
                            <path d={d} fill="none" stroke={WW.terra} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx={last[0]} cy={last[1]} r="2.5" fill={WW.terra} />
                          </svg>
                        );
                      })()}
                      <div style={{ fontSize: 9, color: WW.faint, marginTop: 2 }}>{expandedSlug === a.slug ? '▴' : '▾'}</div>
                    </td>
                  </tr>
                  {expandedSlug === a.slug && (
                    <tr style={{ background: '#FAF7F0', borderBottom: '2px solid #E4DDD2' }}>
                      <td colSpan="5" style={{ padding: '20px 24px' }}>
                        {spark ? (
                          spark.length < 2 ? (
                            <div style={{ fontSize: 12, color: WW.muted, textAlign: 'center' }}>داده کافی برای رسم نمودار ۳۰ روزه وجود ندارد.</div>
                          ) : (() => {
                            const W = 560, H = 80, pad = 4;
                            const n = spark.length;
                            const pts = spark.map((v, si) => [
                              (si / (n - 1)) * (W - pad * 2) + pad,
                              H - pad - (v / max) * (H - pad * 2 - 4),
                            ]);
                            const line = pts.map(([x, y], si) => `${si === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
                            const area = `${line} L ${pts[pts.length-1][0].toFixed(1)},${H} L ${pts[0][0].toFixed(1)},${H} Z`;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: H, direction: 'ltr' }}>
                                  <defs>
                                    <linearGradient id={`spfill-${a.slug}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={WW.terra} stopOpacity="0.22" />
                                      <stop offset="100%" stopColor={WW.terra} stopOpacity="0.01" />
                                    </linearGradient>
                                  </defs>
                                  <path d={area} fill={`url(#spfill-${a.slug})`} />
                                  <path d={line} fill="none" stroke={WW.terra} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  {pts[pts.length - 1] && (
                                    <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.5" fill={WW.terra} />
                                  )}
                                </svg>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: WW.faint, direction: 'ltr' }}>
                                  <span>۳۰ روز پیش</span>
                                  <span>امروز</span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div style={{ fontSize: 12, color: WW.muted, textAlign: 'center' }}>در حال بارگذاری روند...</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #E4DDD2', background: '#FAF7F0', fontWeight: 700 }}>
              <td style={{ padding: '12px 8px', color: WW.ink, fontSize: 12 }}>جمع کل</td>
              <td style={{ padding: '12px 8px', textAlign: 'center', color: WW.terra, fontSize: 12 }}>
                {articles.reduce((s, a) => s + (a.views || 0), 0).toLocaleString('fa-IR')}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'center', color: WW.terra, fontSize: 12 }}>
                {articles.reduce((s, a) => s + (a.reactions || 0), 0).toLocaleString('fa-IR')}
              </td>
              <td style={{ padding: '12px 8px', textAlign: 'center', color: WW.terra, fontSize: 12 }}>
                {articles.reduce((s, a) => s + (a.comments || 0), 0).toLocaleString('fa-IR')}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function WriterWorkspace() {
  const { user, logout } = useAuth();
  const { navigate } = useNav();
  const [tab, setTab] = useState('overview');
  const [editingArticle, setEditingArticle] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    return adminApi.getWriterDashboard()
      .then(setData)
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    load();
    const timer = setInterval(() => { if (!cancelled) load(); }, 20000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [load, user]);

  if (!user) return null;

  const stats = data?.stats ?? {};
  const openEditor = (article = null) => { setEditingArticle(article); setTab('write'); };

  const tabs = [
    { id: 'overview', label: 'آمار من', icon: '◈' },
    { id: 'analytics', label: 'تحلیل‌ها', icon: '▤' },
    { id: 'write',    label: editingArticle ? 'ویرایش' : 'نوشتن', icon: '✦' },
    { id: 'articles', label: 'نوشته‌ها', icon: '◉' },
    { id: 'comments', label: 'نظرها', icon: '◎' },
  ];

  const statCards = [
    { label: 'بازدید',            value: stats.views,     color: WW.terra,   bg: WW.terraLight,   icon: '◉' },
    { label: 'دنبال‌کننده',  value: stats.followers, color: WW.success, bg: WW.successLight, icon: '◎' },
    { label: 'نظر',                               value: stats.comments,  color: WW.gold,    bg: WW.goldLight,    icon: '◇' },
    { label: 'در انتظار بررسی', value: stats.pending, color: WW.purple, bg: WW.purpleLight, icon: '◈' },
    { label: 'پیش‌نویس', value: stats.drafts,    color: WW.muted,   bg: '#F2F4F4',       icon: '◻' },
  ];

  const renderOverview = () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <PanelState loading={loading} error={error}
        empty={!loading && !error && !data}
        emptyTitle="هنوز داده‌ای برای داشبورد ثبت نشده است" />
      {data && (
        <>
          {/* needsRevision alert banner */}
          {(stats.needsRevision > 0) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'linear-gradient(135deg, #FFF8F0, #FFF3E0)',
              border: '1px solid rgba(200,149,28,0.35)',
              borderRadius: 12, padding: '14px 18px',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: WW.goldLight, border: '1px solid rgba(200,149,28,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>⚠</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#7A5A00', marginBottom: 3 }}>
                  {Number(stats.needsRevision).toLocaleString('fa-IR')} {'مقاله نیاز به بازبینی دارد'}
                </div>
                <div style={{ fontSize: 12, color: '#A07A20' }}>
                  {'ویراستار بازخوردی ثبت کرده است. برای مشاهده توضیحات به بخش «نوشته‌ها» بروید.'}
                </div>
              </div>
              <button onClick={() => setTab('articles')} style={{
                ...wwLinkBtn, background: WW.gold, color: '#fff',
                padding: '6px 14px', fontSize: 12, flexShrink: 0,
              }}>
                {'مشاهده →'}
              </button>
            </div>
          )}

          {/* Rotating writing tip */}
          <WritingTipCard />

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(138px,1fr))', gap: 12 }}>
            {statCards.map(({ label, value, color, bg, icon }) => (
              <div key={label} style={{
                background: '#fff', border: `1px solid ${WW.border}`,
                borderRadius: 12, padding: '18px 16px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: 4, height: '100%',
                  background: color, borderRadius: '0 12px 12px 0',
                }} />
                <div style={{
                  width: 34, height: 34, borderRadius: 9, background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color, marginBottom: 12,
                }}>{icon}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>
                  {Number(value ?? 0).toLocaleString('fa-IR')}
                </div>
                <div style={{ fontSize: 11, color: WW.muted, marginTop: 5, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Two-col: articles + comments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }} className="writer-work-grid">
            <section style={{ background: '#fff', border: `1px solid ${WW.border}`, borderRadius: 12, padding: '20px 20px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: WW.ink, fontWeight: 800 }}>
                  {'آخرین نوشته‌ها'}
                </h3>
                <button onClick={() => setTab('articles')} style={wwLinkBtn}>
                  {'همه →'}
                </button>
              </div>
              {(data.recentArticles ?? []).length === 0
                ? <EmptyState title="هنوز نوشته‌ای ندارید" />
                : data.recentArticles.map(article => (
                  <button key={article.id} onClick={() => openEditor(article)} style={{
                    width: '100%', background: 'transparent', border: 0,
                    borderBottom: `1px solid ${WW.border}`, padding: '13px 0',
                    textAlign: 'right', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 700, color: WW.ink, fontSize: 13, lineHeight: 1.6 }}>{article.title}</span>
                      <StatusBadge status={article.status} />
                    </div>
                    <div style={{ fontSize: 11, color: WW.faint, marginTop: 5 }}>
                      {Number(article.views ?? 0).toLocaleString('fa-IR')} {'بازدید ·'} {article.date}
                    </div>
                    {article.status === 'نیازمند اصلاح' && article.reviewNote && (
                      <div style={{ marginTop: 7, padding: '5px 9px', background: 'rgba(200,149,28,0.10)', border: '1px solid rgba(200,149,28,0.28)', borderRadius: 6, fontSize: 11, color: '#7A5A00', lineHeight: 1.7, textAlign: 'right' }}>
                        ⚠ {article.reviewNote}
                      </div>
                    )}
                  </button>
                ))}
            </section>

            <section style={{ background: '#fff', border: `1px solid ${WW.border}`, borderRadius: 12, padding: '20px 20px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: WW.ink, fontWeight: 800 }}>
                  {'نظرهای تازه'}
                </h3>
                <button onClick={() => setTab('comments')} style={wwLinkBtn}>
                  {'همه →'}
                </button>
              </div>
              {(data.recentComments ?? []).length === 0
                ? <EmptyState title="هنوز نظری ثبت نشده است" />
                : data.recentComments.slice(0, 5).map(comment => (
                  <div key={comment.id} style={{ borderBottom: `1px solid ${WW.border}`, padding: '11px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: WW.terra }}>{comment.author?.name}</div>
                      <div style={{ fontSize: 10, color: WW.faint }}>{comment.time}</div>
                    </div>
                    <div style={{ fontSize: 12, color: WW.ink, lineHeight: 1.8 }}>{comment.body}</div>
                    <div style={{ fontSize: 10, color: WW.muted, marginTop: 4 }}>{comment.article?.title}</div>
                  </div>
                ))}
            </section>
          </div>

          {/* Bottom row: weekly chart + monthly goal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="writer-work-grid">
            <div style={{ background: '#fff', border: `1px solid ${WW.border}`, borderRadius: 12, padding: '20px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: WW.ink, marginBottom: 14 }}>
                {'فعالیت هفتگی'}
              </div>
              <WeeklyChart data={(data.viewsByDay ?? []).slice(-7).map(d => d.views ?? 0)} />
              <div style={{ fontSize: 11, color: WW.muted, marginTop: 10, textAlign: 'center' }}>
                {'بازدید روزانه در این هفته'}
              </div>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${WW.border}`, borderRadius: 12, padding: '20px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: WW.ink, marginBottom: 6 }}>
                {'هدف ماهانه'}
              </div>
              <div style={{ fontSize: 11, color: WW.muted, marginBottom: 14 }}>
                {'این ماه: '}{Number(stats.published ?? 0).toLocaleString('fa-IR')}
                {' از ۴ مقاله'}
              </div>
              <div style={{ height: 8, background: WW.terraLight, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: `linear-gradient(to left, ${WW.gold}, ${WW.terra})`,
                  width: `${Math.min(((stats.published ?? 0) / 4) * 100, 100)}%`,
                  transition: 'width 1s ease',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4].map(n => (
                  <div key={n} style={{
                    flex: 1, height: 28, borderRadius: 8,
                    border: `1.5px solid ${n <= (stats.published ?? 0) ? WW.terra : WW.border}`,
                    background: n <= (stats.published ?? 0) ? WW.terraLight : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: n <= (stats.published ?? 0) ? WW.terra : WW.faint,
                    fontWeight: 700, transition: 'all 0.3s',
                  }}>{n <= (stats.published ?? 0) ? '✔' : n.toLocaleString('fa-IR')}</div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: WW.faint, marginTop: 10 }}>
                {'هر ماه ۴ مقاله بنویسید'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: WW.cream, direction: 'rtl', fontFamily: 'Vazirmatn,sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #F2EBE3 0%, #FAF7F0 55%)',
        borderBottom: `1px solid ${WW.border}`,
        padding: '24px clamp(16px,3vw,44px) 0',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: WW.terra, fontWeight: 700,
                background: WW.terraLight, padding: '4px 12px', borderRadius: 20,
                border: `1px solid ${WW.terraBorder}`, marginBottom: 10, letterSpacing: '0.05em',
              }}>
                {'✦ استودیوی نویسنده · تکناو'}
              </div>
              <h1 style={{
                margin: 0, fontSize: 28, fontWeight: 900, color: WW.ink,
                fontFamily: "'PelakFA','Vazirmatn',sans-serif", lineHeight: 1.2,
              }}>
                {(() => {
                  const h = new Date().getHours();
                  if (h < 6)  return 'شب بخیر، ';
                  if (h < 12) return 'صبح بخیر، ';
                  if (h < 17) return 'ظهر بخیر، ';
                  if (h < 21) return 'عصر بخیر، ';
                  return 'شب بخیر، ';
                })()}{user.name}
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: WW.muted }}>
                {(() => {
                  const h = new Date().getHours();
                  if (h < 6)  return 'ساعت کار است یا الهام گرفتن؟';
                  if (h < 12) return 'صبح بهترین وقت نوشتن است.';
                  if (h < 17) return 'امروز چه می‌نویسید؟';
                  return 'شب‌های خلاق را به یاد داشته باشید.';
                })()}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
              <button onClick={() => openEditor(null)} style={wwPrimaryBtn}>
                {'✦ مقاله جدید'}
              </button>
              <button onClick={() => navigate('/admin')} style={wwGhostBtn}>
                {'پنل کامل'}
              </button>
              <button onClick={() => navigate('/')} style={wwGhostBtn}>
                {'سایت'}
              </button>
              <button onClick={() => { logout(); navigate('/'); }} style={wwDangerBtn}>
                {'خروج'}
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {tabs.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '11px 22px', border: 'none', cursor: 'pointer',
                fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, fontWeight: 700,
                background: 'transparent', whiteSpace: 'nowrap',
                color: tab === id ? WW.terra : WW.muted,
                borderBottom: tab === id ? `2.5px solid ${WW.terra}` : '2.5px solid transparent',
                transition: 'color 0.18s, border-color 0.18s',
              }}>
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px clamp(16px,3vw,44px)' }}>
        {tab === 'write' ? (
          <ArticleEditor existing={editingArticle} role="writer" onSave={() => { setEditingArticle(null); setTab('overview'); load(); }} />
        ) : tab === 'articles' ? (
          <ArticlesManagement role="writer" onEdit={openEditor} />
        ) : tab === 'analytics' ? (
          <WriterAnalyticsPanel />
        ) : tab === 'comments' ? (
          <section style={{ background: '#fff', border: `1px solid ${WW.border}`, borderRadius: 12, padding: 24, direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: WW.ink, fontWeight: 800 }}>
                {'نظرها روی نوشته‌های من'}
              </h3>
              {(data?.recentComments ?? []).length > 0 && (
                <span style={{ fontSize: 11, color: WW.faint }}>
                  {(data.recentComments.length).toLocaleString('fa-IR')} {'نظر اخیر'}
                </span>
              )}
            </div>
            <PanelState loading={loading} error={error}
              empty={!loading && !error && (data?.recentComments ?? []).length === 0}
              emptyTitle="هنوز نظری ثبت نشده است" />
            {(data?.recentComments ?? []).map(comment => (
              <div key={comment.id} style={{ borderBottom: `1px solid ${WW.border}`, padding: '16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ color: WW.ink, fontSize: 13 }}>{comment.author?.name}</strong>
                    <span style={{ fontSize: 10, color: WW.faint, background: '#F2F4F4', padding: '2px 7px', borderRadius: 10 }}>
                      {comment.article?.title?.slice(0, 28)}{comment.article?.title?.length > 28 ? '…' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: WW.faint }}>{comment.time}</span>
                </div>
                <p style={{ margin: '0 0 10px', color: WW.ink, lineHeight: 2, fontSize: 13 }}>{comment.body}</p>
                <button onClick={() => navigate(`/article/${comment.article?.slug}`)} style={{ ...wwLinkBtn, fontSize: 11 }}>
                  {'رفتن به مقاله و مشاهده همه نظرها ←'}
                </button>
              </div>
            ))}
            {(data?.recentComments ?? []).length >= 8 && (
              <div style={{ padding: '14px 0 4px', fontSize: 11, color: WW.faint, textAlign: 'center' }}>
                فقط ۸ نظر اخیر نمایش داده می‌شود. برای مشاهده همه نظرها روی مقاله مربوطه بروید.
              </div>
            )}
          </section>
        ) : renderOverview()}
      </div>

      <style>{`
        @media(max-width:900px){
          .writer-work-grid, .writer-editor-meta { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export { AdminPanel, WriterWorkspace, actionBtn };
