// teknav-articles.jsx — Article List + Article Detail (ES module)
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TeknavData } from './teknav-data.js';
import {
  useNav, useToast, useAuth,
  AuthorAvatar, CategoryBadge, TypeBadge, StatusBadge, EmptyState, Header, ReadingProgress,
  ReadingListModal,
  inputStyle, pillBtn, iconBtnStyle,
} from './teknav-ui.jsx';
import { DiagramRenderer } from './teknav-diagrams.jsx';
import { ArticleCard } from './teknav-home.jsx';
import { contentApi } from './src/lib/content-api.js';
import { engagementApi } from './src/lib/engagement-api.js';

function articleDateValue(article) {
  return article?.dateEn || article?.publishedAt || article?.date || '';
}

function articleDateLabel(article) {
  return article?.date || (typeof article?.publishedAt === 'string' ? article.publishedAt.slice(0, 10) : '') || article?.dateEn || '';
}

// ── Article Row (Distill-inspired) ──────────────────────────────────────────
function ArticleRow({ article, idx }) {
  const { navigate } = useNav();
  const [vis, setVis] = useState(false);
  const ref = useRef();
  const cat = TeknavData.categories.find(c => c.id === article.category);
  const author = TeknavData.authors.find(a => a.id === article.authorId);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="article-row" style={{
      display: 'grid', gridTemplateColumns: '1fr 140px', gap: 24,
      padding: '32px 0', borderBottom: '1px solid #E4DDD2', direction: 'rtl',
      cursor: 'pointer', opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(16px)',
      transition: `opacity 0.4s ${idx * 60}ms, transform 0.4s ${idx * 60}ms`,
    }} onClick={() => navigate('/article/' + article.slug)}
       onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
       onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
      <div>
        <div className="article-row-meta" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#5F6B6D' }}>{articleDateLabel(article)}</span>
          <span style={{ color: '#E4DDD2' }}>·</span>
          <TypeBadge type={article.type} small />
          <CategoryBadge name={article.categoryName} color={cat?.color} small />
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#263238', margin: '0 0 6px', lineHeight: 1.5, fontFamily: 'Vazirmatn,sans-serif' }}>{article.title}</h2>
        {article.subtitle && <div style={{ fontSize: 14, color: '#0F6B73', fontWeight: 600, margin: '0 0 8px' }}>{article.subtitle}</div>}
        <div style={{ fontSize: 13, color: '#5F6B6D', margin: '0 0 10px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (article.authorUsername) navigate('/profile/@' + article.authorUsername);
            }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: article.authorUsername ? 'pointer' : 'default', color: article.authorUsername ? '#0F6B73' : '#5F6B6D', fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, fontWeight: 700 }}
          >
            {article.authorName}
          </button>
          {author?.specialty && <span style={{ color: '#E4DDD2' }}> · </span>}
          {author?.specialty && <span>{author.specialty}</span>}
        </div>
        <p style={{ fontSize: 14, color: '#5F6B6D', lineHeight: 1.8, margin: '0 0 12px' }}>{article.summary}</p>
        <div className="article-row-stats" style={{ display: 'flex', gap: 16, fontSize: 12, color: '#5F6B6D', alignItems: 'center' }}>
          <span style={{ color: '#C46A4D', fontWeight: 600 }}>{article.type}</span>
          <span>·</span>
          <span>{article.readTime} دقیقه مطالعه</span>
          <span>·</span>
          <span>{(article.views || 0).toLocaleString('fa')} بازدید</span>
          {article.tags?.slice(0, 2).map(t => (
            <span key={t} style={{ background: '#F4EFE6', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{t}</span>
          ))}
        </div>
      </div>
      {/* Diagram thumbnail */}
      <div className="article-row-thumb" style={{ background: '#F4EFE6', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, alignSelf: 'center' }}>
        <div style={{ transform: 'scale(0.5)', transformOrigin: 'center', width: 280 }}>
          <DiagramRenderer type={article.diagram} compact />
        </div>
      </div>
    </div>
  );
}

// ── Filter Bar ──────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange }) {
  const cats = [{ id: '', name: 'همه' }, ...TeknavData.categories];
  const types = ['همه', 'تحلیل عمیق', 'راهنمای فنی', 'داده‌نما', 'پژوهش', 'راستی‌آزمایی‌شده', 'پرونده'];
  const sorts = [{ v: 'latest', l: 'جدیدترین' }, { v: 'popular', l: 'پربازدیدترین' }, { v: 'readtime', l: 'زمان مطالعه' }];

  const chip = (active) => ({
    border: active ? '1.5px solid #0F6B73' : '1px solid #E4DDD2',
    background: active ? '#0F6B7312' : '#fff',
    color: active ? '#0F6B73' : '#5F6B6D',
    padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
    fontFamily: 'Vazirmatn,sans-serif', fontWeight: active ? 700 : 400,
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  });

  return (
    <div className="filter-bar" style={{ direction: 'rtl', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="filter-chip-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#5F6B6D', whiteSpace: 'nowrap' }}>دسته:</span>
        {cats.map(c => (
          <button key={c.id} style={chip(filters.cat === c.id)} onClick={() => onChange({ ...filters, cat: c.id })}>{c.name}</button>
        ))}
      </div>
      <div className="filter-chip-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#5F6B6D', whiteSpace: 'nowrap' }}>نوع:</span>
        {types.map(t => (
          <button key={t} style={chip(filters.type === t || (!filters.type && t === 'همه'))} onClick={() => onChange({ ...filters, type: t === 'همه' ? '' : t })}>{t}</button>
        ))}
      </div>
      <div className="filter-chip-row" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#5F6B6D' }}>مرتب‌سازی:</span>
          {sorts.map(s => (
            <button key={s.v} style={chip(filters.sort === s.v)} onClick={() => onChange({ ...filters, sort: s.v })}>{s.l}</button>
          ))}
        </div>
        {filters.q && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F4EFE6', padding: '5px 12px', borderRadius: 20 }}>
            <span style={{ fontSize: 12, color: '#263238' }}>جستجو: «{filters.q}»</span>
            <button onClick={() => onChange({ ...filters, q: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5F6B6D', fontSize: 14 }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Article List Page ───────────────────────────────────────────────────────
function ArticleListPage({ initQ = '' }) {
  const [filters, setFilters] = useState({ cat: '', type: '', sort: 'latest', q: initQ });
  const [searchInput, setSearchInput] = useState(initQ);
  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState(() => contentApi.fallbackArticles());
  const PER = 8;

  useEffect(() => {
    let cancelled = false;
    contentApi.listArticles({ limit: 100 })
      .then((res) => { if (!cancelled) setAllArticles(res.items ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = allArticles;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.authorName?.toLowerCase().includes(q) || a.categoryName?.toLowerCase().includes(q));
    }
    if (filters.cat) list = list.filter(a => a.category === filters.cat);
    if (filters.type) list = list.filter(a => a.type === filters.type);
    if (filters.sort === 'popular') list = [...list].sort((a, b) => b.views - a.views);
    else if (filters.sort === 'readtime') list = [...list].sort((a, b) => b.readTime - a.readTime);
    else list = [...list].sort((a, b) => articleDateValue(b).localeCompare(articleDateValue(a)));
    return list;
  }, [filters, allArticles]);

  const visible = filtered.slice(0, page * PER);
  const hasMore = visible.length < filtered.length;

  const doSearch = (e) => { e.preventDefault(); setFilters(f => ({ ...f, q: searchInput })); setPage(1); };

  return (
    <div className="article-list-page" style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif' }}>
      <div className="article-list-inner" style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
        <div className="article-list-head" style={{ direction: 'rtl', padding: '32px 0 0' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263238', margin: '0 0 4px' }}>همه مقاله‌ها</h1>
          <p style={{ fontSize: 14, color: '#5F6B6D', margin: '0 0 28px' }}>{filtered.length} مقاله یافت شد</p>
          {/* Search */}
          <form className="article-search-form" onSubmit={doSearch} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="جستجو در عنوان، خلاصه، نویسنده..."
              style={{ flex: 1, ...inputStyle }} dir="rtl" />
            <button type="submit" style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>جستجو</button>
          </form>
        </div>
        <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />

        {visible.length === 0 ? (
          <EmptyState title="مقاله‌ای یافت نشد" subtitle="فیلترها یا کلمات جستجو را تغییر دهید" />
        ) : (
          <>
            {visible.map((a, i) => <ArticleRow key={a.id} article={a} idx={i} />)}
            {hasMore && (
              <div className="load-more-wrap" style={{ textAlign: 'center', padding: '32px 0' }}>
                <button onClick={() => setPage(p => p + 1)} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', padding: '12px 32px' }}>
                  بارگذاری مقاله‌های بیشتر
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Table of Contents ───────────────────────────────────────────────────────
function TableOfContents({ headings }) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach(h => { const el = document.getElementById(h.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [headings]);

  return (
    <nav style={{ position: 'sticky', top: 90, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', direction: 'rtl' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#5F6B6D', letterSpacing: '0.08em', marginBottom: 12 }}>فهرست مطالب</div>
      {headings.map(h => (
        <a key={h.id} href={'#' + h.id} onClick={e => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          style={{
            display: 'block', padding: h.level === 3 ? '4px 12px' : '5px 0', fontSize: h.level === 3 ? 12 : 13,
            color: active === h.id ? '#0F6B73' : '#5F6B6D', textDecoration: 'none',
            fontWeight: active === h.id ? 700 : 400, borderRight: active === h.id ? '2px solid #0F6B73' : '2px solid transparent',
            transition: 'all 0.15s', lineHeight: 1.5,
          }}>{h.text}</a>
      ))}
    </nav>
  );
}

// ── Article Detail ──────────────────────────────────────────────────────────
function EmbeddedDiagramCard({ title, subtitle, type }) {
  return (
    <div className="article-diagram-card">
      <div style={{ direction: 'rtl', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0F6B73', marginBottom: 4 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#5F6B6D', lineHeight: 1.8 }}>{subtitle}</div>}
      </div>
      <DiagramRenderer type={type} />
    </div>
  );
}

function ArticleEmbeddedDiagrams({ slug }) {
  if (slug === 'ai-clean-data') {
    return (
      <EmbeddedDiagramCard
        title="نمودار تعاملی: پایپ‌لاین داده"
        subtitle="با موس روی هر مرحله بروید تا توضیح بیشتر ببینید"
        type="pipeline"
      />
    );
  }
  if (slug === 'ai-agents-2026' || slug === 'agentic-ai-production') {
    return (
      <div style={{ display: 'grid', gap: 22, margin: '34px 0' }}>
        <EmbeddedDiagramCard
          title="معماری یک AI Agent جدی"
          subtitle="از مدل پایه و حافظه تا ابزارها، کنترل دسترسی، لاگ و بازبینی انسانی."
          type="diagram-12"
        />
        <EmbeddedDiagramCard
          title="جریان تصمیم تا اجرای ابزار"
          subtitle="عامل باید هدف را بشکند، ابزار درست را انتخاب کند، خروجی را ارزیابی کند و فقط در محدوده مجاز اقدام کند."
          type="pipeline"
        />
        <EmbeddedDiagramCard
          title="ریسک‌های امنیتی در حلقه عامل"
          subtitle="هر tool call یک سطح حمله است: prompt injection، نشت داده، سوءاستفاده از مجوز و اقدام اشتباه."
          type="cyber"
        />
        <EmbeddedDiagramCard
          title="حرکت بازار از Copilot به Coworker"
          subtitle="ارزش نرم‌افزار از نمایش داشبورد به واگذاری کنترل‌شده کارهای واقعی منتقل می‌شود."
          type="orbit"
        />
      </div>
    );
  }
  return null;
}

function SeriesNavBanner({ series, currentSlug }) {
  const { navigate } = useNav();
  const idx = series.articles.findIndex(a => a.slug === currentSlug);
  const prev = idx > 0 ? series.articles[idx - 1] : null;
  const next = idx < series.articles.length - 1 ? series.articles[idx + 1] : null;
  if (!prev && !next) return null;
  const btnBase = {
    background: 'transparent', border: '1px solid #0F6B7330', borderRadius: 8,
    padding: '10px 16px', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
    color: '#0F6B73', fontSize: 13, fontWeight: 600, maxWidth: 280, textAlign: 'right',
    transition: 'all 0.15s', lineHeight: 1.5,
  };
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid #E4DDD2', marginTop: 8, direction: 'rtl' }}>
      {prev ? (
        <button onClick={() => navigate('/article/' + prev.slug)} style={{ ...btnBase, borderRight: '3px solid #0F6B73' }}
          onMouseEnter={e => e.currentTarget.style.background = '#0F6B7308'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ fontSize: 10, color: '#5F6B6D', marginBottom: 3 }}>← قسمت قبلی</div>
          <div>{prev.title.slice(0, 50)}{prev.title.length > 50 ? '…' : ''}</div>
        </button>
      ) : <div />}
      {next ? (
        <button onClick={() => navigate('/article/' + next.slug)} style={{ ...btnBase, textAlign: 'left', borderLeft: '3px solid #0F6B73' }}
          onMouseEnter={e => e.currentTarget.style.background = '#0F6B7308'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ fontSize: 10, color: '#5F6B6D', marginBottom: 3, textAlign: 'left' }}>قسمت بعدی →</div>
          <div>{next.title.slice(0, 50)}{next.title.length > 50 ? '…' : ''}</div>
        </button>
      ) : <div />}
    </div>
  );
}

function ArticleQaSection({ slug }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    engagementApi.listQa(slug)
      .then(res => setItems(res.items ?? []))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      if (replyTo) await engagementApi.postAnswer(replyTo.id, body);
      else await engagementApi.postQuestion(slug, body);
      setBody('');
      setReplyTo(null);
      toast('ثبت شد');
      load();
    } catch {
      toast('خطا در ثبت', 'error');
    }
  };

  return (
    <section style={{ marginTop: 48, direction: 'rtl' }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#263238', marginBottom: 20 }}>پرسش و پاسخ</h3>
      {user ? (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 14, marginBottom: 24 }}>
          {replyTo && <div style={{ fontSize: 12, color: '#0F6B73', marginBottom: 8 }}>پاسخ به: {replyTo.author?.name} <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#C94C4C', cursor: 'pointer' }}>لغو</button></div>}
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={replyTo ? 'پاسخ خود را بنویسید...' : 'سوال خود را بپرسید...'} style={{ ...inputStyle, minHeight: 80 }} />
          <div style={{ textAlign: 'left', marginTop: 10 }}>
            <button type="submit" style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>{replyTo ? 'ثبت پاسخ' : 'ثبت پرسش'}</button>
          </div>
        </form>
      ) : <div style={{ background: '#F4EFE6', padding: 16, borderRadius: 12, fontSize: 13, marginBottom: 24 }}>برای پرسیدن سوال وارد شوید.</div>}

      {loading ? <div>در حال بارگذاری...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.length === 0 && <div style={{ fontSize: 13, color: '#5F6B6D' }}>هنوز پرسشی ثبت نشده است.</div>}
          {items.map(q => (
            <div key={q.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{q.author?.name}</div>
                <div style={{ fontSize: 11, color: '#5F6B6D' }}>{q.time}</div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, marginBottom: 12 }}>{q.body}</p>
              <button onClick={() => setReplyTo(q)} style={{ background: 'none', border: 'none', color: '#0F6B73', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>پاسخ دادن</button>
              {q.answers?.map(a => (
                <div key={a.id} style={{ marginTop: 12, padding: 12, borderRight: '2px solid #E4DDD2', background: '#F4EFE680', borderRadius: '0 8px 8px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{a.author?.name}</div>
                  <p style={{ fontSize: 13, lineHeight: 1.7 }}>{a.body}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ArticleCommentSection({ article, onTotal }) {
  const { user } = useAuth();
  const { navigate } = useNav();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    return engagementApi.listComments(article.slug)
      .then(res => {
        setItems(res?.items ?? []);
        onTotal?.(res?.total ?? 0);
      })
      .catch(() => { setItems([]); setError(true); })
      .finally(() => setLoading(false));
  }, [article.slug, onTotal]);

  useEffect(() => { refresh(); }, [refresh]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await engagementApi.postComment(article.slug, body, replyTo?.id);
      setBody('');
      setReplyTo(null);
      toast('نظر شما ثبت شد');
      refresh();
    } catch {
      toast('ثبت نظر ناموفق بود', 'error');
    }
  };

  const upvote = async (id) => {
    try {
      const res = await engagementApi.upvoteComment(id);
      setItems(current => current.map(comment => {
        if (comment.id === id) return { ...comment, upvotedByMe: res.upvoted, upvoteCount: res.upvoteCount };
        return { ...comment, replies: (comment.replies ?? []).map(reply => reply.id === id ? { ...reply, upvotedByMe: res.upvoted, upvoteCount: res.upvoteCount } : reply) };
      }));
    } catch {
      toast('برای رأی دادن ابتدا وارد شوید', 'warning');
    }
  };

  const flag = async (id) => {
    try {
      await engagementApi.flagComment(id);
      toast('گزارش نظر ثبت شد');
      refresh();
    } catch {
      toast('برای گزارش نظر ابتدا وارد شوید', 'warning');
    }
  };

  const like = async (id) => {
    try {
      const res = await engagementApi.likeComment(id);
      setItems(current => current.map(comment => {
        if (comment.id === id) return { ...comment, likedByMe: res.liked, likeCount: res.likeCount };
        return { ...comment, replies: (comment.replies ?? []).map(reply => reply.id === id ? { ...reply, likedByMe: res.liked, likeCount: res.likeCount } : reply) };
      }));
    } catch {
      toast('برای پسندیدن نظر ابتدا وارد شوید', 'warning');
    }
  };

  const renderComment = (comment, child = false) => (
    <div key={comment.id} style={{ background: child ? '#FAF7F0' : '#fff', border: '1px solid #E4DDD2', borderRadius: 10, padding: 14, marginTop: child ? 10 : 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <button
            onClick={() => comment.author?.username && navigate('/profile/@' + comment.author.username)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: comment.author?.username ? 'pointer' : 'default', fontFamily: 'Vazirmatn,sans-serif', fontSize: 13, fontWeight: 800, color: comment.author?.username ? '#0F6B73' : '#263238' }}
          >
            {comment.author?.name ?? 'کاربر'}
          </button>
          <div style={{ fontSize: 11, color: '#5F6B6D' }}>@{comment.author?.username ?? 'user'} · {comment.time}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => upvote(comment.id)} style={{
            ...pillBtn, padding: '4px 10px', fontSize: 12,
            background: comment.upvotedByMe ? '#0F6B7318' : '#F4EFE6',
            color: comment.upvotedByMe ? '#0F6B73' : '#263238',
            border: `1px solid ${comment.upvotedByMe ? '#0F6B7340' : '#E4DDD2'}`,
          }}>
            ▲ {Number(comment.upvoteCount ?? 0).toLocaleString('fa-IR')}
          </button>
          <button onClick={() => flag(comment.id)} style={{ ...pillBtn, background: '#F4EFE6', color: '#5F6B6D', fontSize: 11, padding: '4px 10px' }}>گزارش</button>
        </div>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.9, color: '#263238' }}>{comment.body}</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <button onClick={() => like(comment.id)} style={{ ...pillBtn, background: comment.likedByMe ? '#0F6B7318' : 'transparent', color: comment.likedByMe ? '#0F6B73' : '#5F6B6D', fontSize: 12, padding: '4px 8px', border: comment.likedByMe ? '1px solid #0F6B7330' : '1px solid transparent' }}>
          پسندیدن {Number(comment.likeCount ?? 0).toLocaleString('fa-IR')}
        </button>
        {user && !child && <button onClick={() => setReplyTo(comment)} style={{ ...pillBtn, background: 'transparent', color: '#0F6B73', fontSize: 12, padding: '4px 0' }}>پاسخ</button>}
      </div>      {comment.replies?.map(reply => renderComment(reply, true))}
    </div>
  );

  return (
    <section style={{ borderTop: '1px solid #E4DDD2', marginTop: 40, paddingTop: 24, direction: 'rtl' }}>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#263238', margin: '0 0 16px' }}>نظرها</h3>
      {user ? (
        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          {replyTo && (
            <div style={{ fontSize: 12, color: '#0F6B73', marginBottom: 8 }}>
              پاسخ به {replyTo.author?.name}
              <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#C94C4C', cursor: 'pointer', marginRight: 8 }}>لغو</button>
            </div>
          )}
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} placeholder="نظر خود را بنویسید..." style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} dir="rtl" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: '#5F6B6D' }}>{body.length.toLocaleString('fa-IR')} / ۱۰۰۰</span>
            <button type="submit" style={{ ...pillBtn, background: '#0F6B73', color: '#fff' }}>ثبت نظر</button>
          </div>
        </form>
      ) : (
        <div style={{ background: '#F4EFE6', border: '1px solid #E4DDD2', borderRadius: 12, padding: 16, color: '#5F6B6D', fontSize: 13 }}>
          برای نظر دادن وارد شوید.
        </div>
      )}
      {loading && <div style={{ color: '#5F6B6D', fontSize: 13 }}>در حال بارگذاری نظرها...</div>}
      {error && <EmptyState title="نظرها از API دریافت نشد" />}
      {!loading && !error && items.length === 0 && <EmptyState title="هنوز نظری ثبت نشده است" />}
      {!loading && !error && items.map(comment => renderComment(comment))}
    </section>
  );
}

function PremiumGateCard({ navigate, user }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F2A2E 0%, #1A3A40 100%)',
      borderRadius: 16, padding: '36px 32px', marginTop: -24, position: 'relative',
      border: '1px solid #D49A2A40', direction: 'rtl', textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>👑</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#D49A2A', marginBottom: 8 }}>این مقاله برای اعضای ویژه</div>
      <div style={{ fontSize: 14, color: '#A8B8BA', marginBottom: 24, lineHeight: 1.8 }}>
        برای مطالعه کامل این مقاله، عضو ویژه تکناو شوید
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'inline-block', textAlign: 'right' }}>
        {[
          '✓  دسترسی به همه مقالات ویژه',
          '✓  تجربه بدون تبلیغ',
          '✓  حمایت مستقیم از تکناو',
        ].map((item) => (
          <li key={item} style={{ color: '#C8D8DA', fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>{item}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/membership')} style={{
          background: 'linear-gradient(135deg, #D49A2A, #B8821E)', color: '#fff',
          border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
        }}>عضویت ویژه</button>
        {!user && (
          <button onClick={() => navigate('/login')} style={{
            background: 'transparent', color: '#A8B8BA',
            border: '1px solid #A8B8BA60', borderRadius: 8, padding: '12px 24px', fontSize: 14,
            cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif',
          }}>ورود به حساب</button>
        )}
      </div>
    </div>
  );
}

function ArticleDetail({ slug }) {
  const { navigate } = useNav();
  const { user } = useAuth();
  const toast = useToast();
  const canonicalSlug = slug === 'ai-agents-2026' ? 'agentic-ai-production' : slug;
  const [saved, setSaved] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [reacted, setReacted] = useState({});
  const [article, setArticle] = useState(() => contentApi.fallbackArticles().find(a => a.slug === canonicalSlug));
  const [related, setRelated] = useState([]);
  const [commentTotal, setCommentTotal] = useState(0);

  // Inject IDs into headings in content
  const processedContent = useMemo(() => {
    if (!article?.content) return '';
    let hidx = 0;
    return article.content.replace(/<h([23])[^>]*>([^<]+)<\/h\1>/g, (_, lvl, txt) => {
      const id = 'h-' + hidx++;
      return `<h${lvl} id="${id}">${txt}</h${lvl}>`;
    });
  }, [article?.content]);

  useEffect(() => {
    let cancelled = false;
    if (slug !== canonicalSlug && typeof window !== 'undefined') {
      window.history.replaceState({}, '', `/article/${canonicalSlug}`);
    }
    const fallback = contentApi.fallbackArticles().find(a => a.slug === canonicalSlug);
    setArticle(fallback);
    setRelated(fallback ? contentApi.fallbackArticles().filter(a => a.category === fallback.category && a.id !== fallback.id).slice(0, 3) : []);
    setSaved(false);
    setReacted({});
    contentApi.getArticle(canonicalSlug)
      .then((res) => {
        if (cancelled) return;
        setArticle(res.article);
        setRelated(res.related ?? []);
        setSaved(!!res.saved);
        setReacted(res.reactions ?? {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canonicalSlug]);

  useEffect(() => {
    if (!article?.id) return;
    const h = () => {
      const el = document.documentElement;
      const progress = (el.scrollTop || document.body.scrollTop) / (el.scrollHeight - el.clientHeight);
      if (progress > 0.05) {
        engagementApi.recordHistory(article.id, Math.min(progress, 1)).catch(() => {});
      }
    };
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, [article?.id]);

  // Inject copy buttons + language labels into rendered code blocks
  useEffect(() => {
    if (!processedContent) return;
    document.querySelectorAll('.article-content pre').forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;
      const code = pre.querySelector('code');
      const lang = code?.className?.match(/language-(\w+)/)?.[1];
      if (lang) pre.setAttribute('data-lang', lang);
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = 'کپی';
      btn.onclick = () => {
        navigator.clipboard?.writeText(code?.textContent ?? '').then(() => {
          btn.textContent = '✓ کپی شد';
          setTimeout(() => { btn.textContent = 'کپی'; }, 2000);
        }).catch(() => {});
      };
      pre.appendChild(btn);
    });
  }, [processedContent]);

  if (!article) return (
    <div style={{ paddingTop: 100, textAlign: 'center', fontFamily: 'Vazirmatn,sans-serif' }}>
      <EmptyState title="مقاله یافت نشد" subtitle="این مقاله وجود ندارد یا حذف شده است" />
      <button onClick={() => navigate('/articles')} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', marginTop: 16 }}>بازگشت به مقاله‌ها</button>
    </div>
  );

  const author = article.author || TeknavData.authors.find(a => a.id === article.authorId);
  const cat = TeknavData.categories.find(c => c.id === article.category);
  const discoverImage = null; // Images disabled for now as they are not generated

  // Parse headings from content
  const headings = [];
  const h2re = /<h2[^>]*>([^<]+)<\/h2>/g;
  const h3re = /<h3[^>]*>([^<]+)<\/h3>/g;
  let m;
  while ((m = h2re.exec(article.content || '')) !== null) headings.push({ id: 'h-' + headings.length, text: m[1], level: 2 });
  while ((m = h3re.exec(article.content || '')) !== null) headings.push({ id: 'h-' + headings.length, text: m[1], level: 3 });

  const handleSave = async () => {
    try {
      const res = await contentApi.toggleSaved(article.id);
      setSaved(!!res.saved);
      if (res.saved) setListModalOpen(true);
      toast(res.saved ? 'در لیست مطالعه ذخیره شد' : 'از ذخیره‌شده‌ها حذف شد');
    } catch {
      toast('برای ذخیره مقاله ابتدا وارد شوید', 'warning');
    }
  };

  const handleShare = (channel = 'copy') => {
    const url = window.location.href;
    const text = article.title;
    contentApi.trackEvent({
      type: 'share_clicked',
      articleId: article.id,
      topic: article.category,
      metadata: { channel },
    }).catch(() => {});

    if (channel === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'x') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    navigator.clipboard?.writeText(url).catch(() => {});
    toast('لینک مقاله کپی شد');
  };

  const handleReact = async (type) => {
    try {
      const res = await contentApi.toggleReaction(article.id, type);
      setReacted(r => ({ ...r, [type]: !!res.active }));
      if (res.active) toast('واکنش شما ثبت شد');
    } catch {
      toast('برای ثبت واکنش ابتدا وارد شوید', 'warning');
    }
  };

  return (
    <div className="article-detail-page" style={{ paddingTop: 64, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', overflowX: 'hidden', maxWidth: '100vw' }}>
      <ReadingProgress />

      {/* Breadcrumb */}
      <div className="article-breadcrumb" style={{ background: '#F4EFE6', borderBottom: '1px solid #E4DDD2', padding: '12px 24px', direction: 'rtl', fontSize: 12, color: '#5F6B6D' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F6B73', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif', padding: 0 }}>خانه</button>
          <span>›</span>
          <button onClick={() => navigate('/category/' + article.category)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F6B73', fontSize: 12, fontFamily: 'Vazirmatn,sans-serif', padding: 0 }}>{article.categoryName}</button>
          <span>›</span>
          <span style={{ color: '#263238', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '1 1 auto' }}>{article.title.slice(0, 40)}…</span>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 48, direction: 'rtl', overflowX: 'hidden', minWidth: 0 }} className="article-layout">
        {/* TOC sidebar */}
        <aside className="toc-sidebar" role="complementary" aria-label="فهرست مطالب">
          {headings.length > 0 && <TableOfContents headings={headings} />}
        </aside>

        {/* Main content */}
        <article className="article-main" style={{ maxWidth: 760, direction: 'rtl', minWidth: 0, overflowX: 'hidden' }}>
          {/* Header */}
          <header className="article-header" style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #E4DDD2' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <TypeBadge type={article.type} />
              <CategoryBadge name={article.categoryName} color={cat?.color} />
              <StatusBadge status={article.status} />
              {article.sponsored && <span style={{ background: '#FFF4D8', color: '#8A5A00', border: '1px solid #D49A2A55', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 800 }}>Promoted Content</span>}
              {article.premiumOnly && <span style={{ background: '#0F2A2E', color: '#D49A2A', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 800 }}>Premium</span>}
            </div>
            <h1 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, color: '#263238', margin: '0 0 12px', lineHeight: 1.4, fontFamily: 'Vazirmatn,sans-serif', wordWrap: 'break-word', overflowWrap: 'break-word', hyphens: 'auto', maxWidth: '100%' }}>{article.title}</h1>
            {article.subtitle && <p style={{ fontSize: 18, color: '#5F6B6D', margin: '0 0 20px', lineHeight: 1.6, fontWeight: 400 }}>{article.subtitle}</p>}

            <div className="article-byline-row" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {author && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AuthorAvatar author={author} size={40} />
                  <div>
                    <button
                      onClick={() => article.authorUsername && navigate('/profile/@' + article.authorUsername)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: article.authorUsername ? 'pointer' : 'default', fontFamily: 'Vazirmatn,sans-serif', fontSize: 14, fontWeight: 700, color: article.authorUsername ? '#0F6B73' : '#263238' }}
                      aria-label={`نویسنده: ${author.name}`}
                    >
                      {author.name}
                      {author.verifiedExpert && <span style={{ marginRight: 6, fontSize: 11, color: '#0F6B73', background: '#0F6B7314', border: '1px solid #0F6B7330', borderRadius: 999, padding: '1px 6px' }}>تاییدشده</span>}
                    </button>
                    <div style={{ fontSize: 12, color: '#5F6B6D' }}>{author.specialty}</div>
                  </div>
                </div>
              )}
              <div className="article-meta-line" style={{ fontSize: 13, color: '#5F6B6D', display: 'flex', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
                <time dateTime={article.dateEn}>{articleDateLabel(article)}</time>
                <span>·</span>
                <span style={{ color: '#C46A4D', fontWeight: 600, fontSize: 11 }}>{article.type}</span>
                <span>·</span>
                <span>{article.readTime} دقیقه مطالعه</span>
                <span>·</span>
                <span>{commentTotal.toLocaleString('fa-IR')} نظر</span>
              </div>
            </div>

            {/* Actions */}
            <div className="article-action-row" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={handleSave} style={{ ...pillBtn, background: saved ? '#0F6B7318' : '#F4EFE6', color: saved ? '#0F6B73' : '#263238', border: saved ? '1px solid #0F6B7340' : '1px solid #E4DDD2', padding: '6px 14px' }}>
                {saved ? '✓ ذخیره‌شده' : '⊕ ذخیره'}
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderRight: '1px solid #E4DDD2', paddingRight: 10 }}>
                <button onClick={() => handleShare('telegram')} title="تلگرام" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', color: '#0088cc' }} aria-label="اشتراک در تلگرام">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.198-.054-.31-.346-.11l-6.4 4.02-2.76-.86c-.6-.188-.61-.6.126-.894l10.78-4.148c.5-.188.94.116.808.843z"/></svg>
                </button>
                <button onClick={() => handleShare('whatsapp')} title="واتساپ" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', color: '#25D366' }} aria-label="اشتراک در واتساپ">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 0C5.412 0 0 5.414 0 12.035c0 2.124.553 4.195 1.603 6.01L.063 23.575l5.666-1.486c1.765.952 3.738 1.455 5.765 1.455 6.617 0 12.03-5.412 12.03-12.034S18.647 0 12.031 0zm0 21.601c-1.782 0-3.52-.48-5.04-1.385l-.36-.215-3.75.983.998-3.66-.236-.375C2.69 15.352 2.15 13.722 2.15 12.035 2.15 6.593 6.577 2.15 12.03 2.15s9.88 4.443 9.88 9.885c0 5.44-4.428 9.881-9.88 9.881zm5.417-7.41c-.297-.15-1.762-.871-2.036-.973-.274-.102-.473-.15-.672.15-.202.3-.77 .973-.944 1.173-.175.2-.35.225-.648.075-.297-.15-1.258-.464-2.395-1.405-.885-.733-1.482-1.64-1.657-1.94-.175-.3 0-.462.15-.612.134-.135.297-.35.446-.525.15-.175.2-.3.297-.5.102-.2.05-.375-.025-.525-.075-.15-.672-1.618-.92-2.215-.24-.582-.483-.502-.67-.512-.174-.01-.373-.01-.57-.01s-.52.075-.794.375c-.274.3-1.045 1.025-1.045 2.5 0 1.475 1.07 2.9 1.22 3.1.15.2 2.115 3.226 5.126 4.526 2.053.886 2.85 1.018 3.86 1.045.894.025 2.87-.923 3.27-1.848.397-.925.397-1.722.274-1.895-.125-.175-.472-.275-.77-.425z"/></svg>
                </button>
                <button onClick={() => handleShare('x')} title="X (Twitter)" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', color: '#14171A' }} aria-label="اشتراک در X">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
                <button onClick={() => handleShare('linkedin')} title="لینکدین" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', color: '#0A66C2' }} aria-label="اشتراک در لینکدین">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </button>
                <button onClick={() => handleShare('copy')} title="کپی لینک" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', color: '#5F6B6D' }} aria-label="کپی لینک مقاله">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </header>

          {article.series && (
            <div style={{ background: '#0F6B7308', border: '1px solid #0F6B7330', borderRadius: 10, padding: 16, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#0F6B73', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>سری مقاله</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#263238' }}>{article.series.title}</span>
                {article.series.articles?.length > 0 && (
                  <span style={{ fontSize: 11, color: '#5F6B6D' }}>قسمت {article.series.position} از {article.series.articles.length}</span>
                )}
              </div>
              <button onClick={() => navigate('/series/' + article.series.slug)} style={{ background: 'transparent', border: 'none', color: '#0F6B73', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>مشاهده همه قسمت‌ها ←</button>
            </div>
          )}

          {discoverImage && (
            <figure className="article-discover-hero" style={{ margin: '0 0 28px', borderRadius: 12, overflow: 'hidden', border: '1px solid #E4DDD2', background: '#F4EFE6' }}>
              <img src={discoverImage} alt={article.ogTitle || article.title} width="1200" height="630" loading="eager" fetchPriority="high" decoding="async" style={{ display: 'block', width: '100%', aspectRatio: '1200 / 630', objectFit: 'cover' }} />
            </figure>
          )}

          {(article.correctionNotice || article.corrections?.length > 0) && (
            <section style={{ background: '#FFF8EA', border: '1px solid #D49A2A55', borderRadius: 12, padding: 18, marginBottom: 28, direction: 'rtl' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#263238', marginBottom: 8 }}>اصلاحیه و به‌روزرسانی</div>
              {article.correctionNotice && <p style={{ margin: '0 0 10px', color: '#5F6B6D', lineHeight: 1.9 }}>{article.correctionNotice}</p>}
              {article.corrections?.length > 0 && (
                <ul style={{ margin: 0, paddingRight: 18, color: '#5F6B6D', lineHeight: 1.9, fontSize: 13 }}>
                  {article.corrections.map(item => <li key={item.id}>{item.date || new Date(item.createdAt).toLocaleDateString('fa-IR')}: {item.note}</li>)}
                </ul>
              )}
            </section>
          )}

          {/* Hero diagram */}
          <div className="article-hero-diagram" style={{ background: '#F4EFE6', borderRadius: 12, padding: 24, marginBottom: 32, overflow: 'hidden', maxWidth: '100%', overflowX: 'auto' }}>
            <div style={{ fontSize: 11, color: '#5F6B6D', marginBottom: 8, fontWeight: 600 }}>نمودار تعاملی — با موس روی عناصر بروید</div>
            <DiagramRenderer type={article.diagram} />
          </div>

          {/* Content */}
          <div style={{ position: 'relative' }}>
            <div className="article-content" style={{
              ...articleContentStyle,
              ...(article.premiumLocked ? {
                maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
                maxHeight: 320, overflow: 'hidden',
              } : {}),
              maxWidth: '100%', overflowX: 'hidden', wordWrap: 'break-word', overflowWrap: 'break-word',
            }} dangerouslySetInnerHTML={{ __html: processedContent }} />
          </div>
          {article.premiumLocked && <PremiumGateCard navigate={navigate} user={user} />}

          <ArticleEmbeddedDiagrams slug={article.slug} />

          {/* Reactions */}
          <div style={{ borderTop: '1px solid #E4DDD2', marginTop: 40, paddingTop: 24, direction: 'rtl' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#263238', marginBottom: 16 }}>واکنش شما به این مقاله؟</div>
            <div className="article-reaction-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                ['helpful', 'مفید', '👍'],
                ['star', 'عالی', '⭐'],
                ['heart', 'عاشقانه', '❤️'],
                ['fire', 'داغ', '🔥'],
                ['thinking', 'تأمل‌برانگیز', '🤔'],
              ].map(([type, label, icon]) => (
                <button key={type} onClick={() => handleReact(type)} style={{
                  ...pillBtn, background: reacted[type] ? '#0F6B7318' : '#F4EFE6',
                  color: reacted[type] ? '#0F6B73' : '#263238',
                  border: `1px solid ${reacted[type] ? '#0F6B7340' : '#E4DDD2'}`,
                  fontSize: 13, padding: '8px 14px',
                }}>{icon} {label}</button>
              ))}
            </div>
          </div>

          {article.series?.articles?.length > 1 && (
            <SeriesNavBanner series={article.series} currentSlug={article.slug} />
          )}

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div style={{ marginTop: 24, direction: 'rtl', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#5F6B6D' }}>برچسب‌ها:</span>
              {article.tags.map(t => (
                <button key={t} onClick={() => navigate(`/tag/${encodeURIComponent(t)}`)} style={{ background: '#F4EFE6', border: '1px solid #E4DDD2', padding: '3px 10px', borderRadius: 4, fontSize: 12, color: '#5F6B6D', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>{t}</button>
              ))}
            </div>
          )}

          <ArticleCommentSection article={article} onTotal={setCommentTotal} />
          
          <ArticleQaSection slug={article.slug} />

          {/* Author bio */}
          {author && (
            <div className="article-author-box" style={{ background: '#F4EFE6', borderRadius: 12, padding: 24, marginTop: 32, direction: 'rtl', display: 'flex', gap: 16 }}>
              <AuthorAvatar author={author} size={64} />
              <div>
                <div style={{ fontSize: 11, color: '#5F6B6D', marginBottom: 4 }}>نویسنده</div>
                <button
                  onClick={() => article.authorUsername && navigate('/profile/@' + article.authorUsername)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: article.authorUsername ? 'pointer' : 'default', fontFamily: 'Vazirmatn,sans-serif', fontSize: 16, fontWeight: 700, color: article.authorUsername ? '#0F6B73' : '#263238', marginBottom: 6 }}
                >
                  {author.name}
                  {author.verifiedExpert && <span style={{ marginRight: 6, fontSize: 11, color: '#0F6B73', background: '#fff', border: '1px solid #0F6B7330', borderRadius: 999, padding: '1px 6px' }}>تاییدشده</span>}
                </button>
                <div style={{ fontSize: 13, color: '#5F6B6D', lineHeight: 1.7 }}>{author.bio}</div>
                <div className="article-social-row" style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  {Object.entries(author.social || {}).map(([k]) => (
                    <button key={k} style={{ ...pillBtn, background: '#fff', color: '#0F6B73', border: '1px solid #0F6B7330', fontSize: 12, padding: '4px 12px' }}>{k}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Related */}
          {related.length > 0 && (
            <div className="article-related" style={{ marginTop: 48, direction: 'rtl' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#263238', marginBottom: 20 }}>مقاله‌های مرتبط</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
                {related.map(a => <ArticleCard key={a.id} article={a} />)}
              </div>
            </div>
          )}
        </article>
      </div>

      <style>{`
        .article-layout { grid-template-columns: 200px 1fr; }
        .toc-sidebar { display: block; }
        @media (max-width: 900px) {
          .article-layout { grid-template-columns: 1fr !important; }
          .toc-sidebar { display: none !important; }
        }
      `}</style>

      {listModalOpen && <ReadingListModal articleId={article.id} onDone={() => setListModalOpen(false)} />}
    </div>
  );
}

const articleContentStyle = {
  fontSize: 16, lineHeight: 2, color: '#263238', direction: 'rtl',
  fontFamily: 'Vazirmatn,sans-serif',
};

// Inject article content styles globally
const articleCSS = `
  article h2 { font-size: 22px; font-weight: 800; color: #263238; margin: 40px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #E4DDD2; font-family: Vazirmatn,sans-serif; }
  article h3 { font-size: 18px; font-weight: 700; color: #263238; margin: 32px 0 12px; font-family: Vazirmatn,sans-serif; }
  article p { margin: 0 0 20px; }
  article blockquote { border-right: 4px solid #D49A2A; margin: 28px 0; padding: 16px 20px; background: #D49A2A0A; border-radius: 0 8px 8px 0; font-size: 16px; color: #263238; font-style: normal; }
  article blockquote.security-quote { border-right-color: #C94C4D; background: #C94C4D08; }
  article strong { color: #263238; font-weight: 700; }
  article em { color: #0F6B73; font-style: normal; font-weight: 600; }

  /* Code blocks */
  article pre { background: #131F22; border-radius: 10px; padding: 40px 18px 18px; margin: 24px 0; overflow-x: auto; position: relative; border: 1px solid #1E3035; direction: ltr; }
  article pre::before { content: attr(data-lang); position: absolute; top: 10px; right: 14px; font-size: 10px; color: #4A7A82; font-family: monospace; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
  article pre code { background: none !important; border: none !important; padding: 0 !important; color: #A8D8DC; font-family: 'Courier New', Consolas, monospace; font-size: 13.5px; line-height: 1.85; display: block; direction: ltr; text-align: left; white-space: pre; }
  article code:not(pre code) { background: #0F6B7316; border: 1px solid #0F6B7328; border-radius: 4px; padding: 1px 6px; font-family: 'Courier New', Consolas, monospace; font-size: 13px; color: #0A5060; direction: ltr; unicode-bidi: isolate; display: inline; white-space: nowrap; }
  .code-copy-btn { position: absolute; top: 8px; left: 10px; background: #1E3035; border: 1px solid #2A4048; color: #6AACB5; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: Vazirmatn, sans-serif; z-index: 1; transition: all 0.15s; line-height: 1.4; }
  .code-copy-btn:hover { background: #2A4048; color: #A8D8DC; }

  /* Lists */
  article ul { padding-right: 0; list-style: none; margin: 16px 0 24px; display: grid; gap: 6px; }
  article ul li { position: relative; padding-right: 22px; color: #263238; line-height: 1.9; }
  article ul li::before { content: '›'; position: absolute; right: 4px; color: #0F6B73; font-weight: 900; font-size: 17px; line-height: 1.6; }
  article ol { padding-right: 0; counter-reset: art-counter; list-style: none; margin: 16px 0 24px; display: grid; gap: 8px; }
  article ol li { counter-increment: art-counter; position: relative; padding-right: 38px; color: #263238; line-height: 1.9; padding-top: 2px; }
  article ol li::before { content: counter(art-counter); position: absolute; right: 0; top: 2px; width: 24px; height: 24px; background: #0F6B73; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
  article ul li code, article ol li code { font-size: 12px; }
  article ul li strong, article ol li strong { color: #0A5060; }

  article .ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; font-family: Inter, Arial, sans-serif; letter-spacing: 0; }
  article .metric-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 12px; margin: 28px 0; }
  article .metric-card { background: #fff; border: 1px solid #E4DDD2; border-top: 3px solid #0F6B73; border-radius: 10px; padding: 14px 16px; }
  article .metric-value { color: #0F6B73; font-weight: 900; font-size: 22px; line-height: 1.2; }
  article .metric-label { color: #5F6B6D; font-size: 12px; line-height: 1.7; margin-top: 6px; }
  article table { width: 100%; border-collapse: collapse; margin: 24px 0; background: #fff; border: 1px solid #E4DDD2; border-radius: 10px; overflow: hidden; display: block; max-width: 100%; overflow-x: auto; }
  article th, article td { border-bottom: 1px solid #E4DDD2; padding: 12px 14px; text-align: right; vertical-align: top; min-width: 130px; }
  article th { background: #F4EFE6; color: #263238; font-weight: 800; }
  article tr:last-child td { border-bottom: 0; }
  article .comparison-template { background: #fffaf1; border: 1px solid #E4DDD2; border-radius: 12px; padding: 18px; margin: 24px 0; }
  article .risk-box { background: #C46A4D10; border: 1px solid #C46A4D35; border-radius: 12px; padding: 18px 22px; margin: 28px 0; }
  article .agent-steps { counter-reset: agentStep; display: grid; gap: 10px; margin: 24px 0; }
  article .agent-step { counter-increment: agentStep; background: #fff; border: 1px solid #E4DDD2; border-radius: 10px; padding: 14px 48px 14px 16px; position: relative; }
  article .agent-step::before { content: counter(agentStep); position: absolute; top: 14px; right: 14px; width: 24px; height: 24px; border-radius: 50%; background: #0F6B73; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 800; }
  .article-diagram-card { background: linear-gradient(135deg,#F4EFE6 0%,#FFFFFF 100%); border: 1px solid #E4DDD2; border-radius: 12px; padding: 22px; overflow: hidden; box-shadow: 0 12px 34px rgba(15,42,46,0.06); }
  .insight-box { background: #0F6B7310; border: 1px solid #0F6B7330; border-radius: 10px; padding: 20px 24px; margin: 28px 0; }
  .insight-box .insight-title { font-size: 13px; font-weight: 700; color: #0F6B73; margin-bottom: 8px; }
  .insight-box p { margin: 0; font-size: 14px; line-height: 1.8; }
  .footnote-box { background: #F4EFE6; border-radius: 8px; padding: 16px 20px; margin-top: 32px; font-size: 12px; color: #5F6B6D; line-height: 1.7; }

  /* CVE summary card (security articles) */
  .cve-summary-card { background: linear-gradient(135deg, #EEF6F7 0%, #E8F3F4 100%); border: 1px solid rgba(15,107,115,0.18); border-radius: 12px; padding: 20px 24px; margin: 0 0 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; direction: rtl; }
  .cve-summary-card .cve-item { display: flex; flex-direction: column; gap: 5px; border-left: 1px solid rgba(15,107,115,0.15); padding-left: 16px; }
  .cve-summary-card .cve-item:last-child { border-left: none; padding-left: 0; }
  .cve-summary-card .cve-label { font-size: 10px; color: #0F6B73; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .cve-summary-card .cve-value { font-size: 14px; font-weight: 800; color: #1A3035; }
  .cve-summary-card .cve-score { font-size: 28px; font-weight: 900; color: #C0392B; line-height: 1; }
  .cve-summary-card .cve-critical { color: #C0392B; }
  .cve-summary-card .cve-patched { color: #1A7A50; font-size: 13px; }

  /* Security alert inline box */
  .security-alert { background: #C94C4D0A; border: 1px solid #C94C4D30; border-right: 4px solid #C94C4D; border-radius: 0 10px 10px 0; padding: 16px 20px; margin: 28px 0; }
  .security-alert .alert-title { font-size: 13px; font-weight: 800; color: #C94C4D; margin-bottom: 6px; }
  .security-alert p, .security-alert li { font-size: 14px; line-height: 1.8; color: #3A1A1A; margin: 0; }

  /* Mobile responsive fixes */
  @media (max-width: 640px) {
    article pre { 
      padding: 32px 12px 12px !important; 
      margin: 20px 0 !important; 
      font-size: 12px !important;
      max-width: calc(100vw - 32px) !important;
    }
    article code:not(pre code) { 
      font-size: 11px !important; 
      padding: 1px 4px !important;
      word-break: break-all !important;
    }
    
    .cve-summary-card { 
      grid-template-columns: 1fr !important; 
      padding: 16px !important;
      gap: 12px !important;
    }
    .cve-summary-card .cve-item { 
      border-left: none !important; 
      border-bottom: 1px solid rgba(15,107,115,0.15) !important;
      padding-left: 0 !important;
      padding-bottom: 12px !important;
    }
    .cve-summary-card .cve-item:last-child { 
      border-bottom: none !important; 
      padding-bottom: 0 !important;
    }
    
    article table { font-size: 13px !important; }
    article table td, article table th { padding: 6px 8px !important; min-width: 80px !important; }
    
    article .metric-grid { grid-template-columns: 1fr !important; }
  }
`;
const styleEl = document.createElement('style');
styleEl.textContent = articleCSS;
document.head.appendChild(styleEl);

export { ArticleRow, FilterBar, ArticleListPage, TableOfContents, ArticleDetail };
