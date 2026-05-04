// teknav-app.jsx — Main App Router (ES module)
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  NavProvider, AuthProvider, ToastProvider,
  Header, Footer, EmptyState, useNav, InstallPrompt, PushNotificationPrompt, useAuth,
} from './teknav-ui.jsx';
import { HomePage } from './teknav-home.jsx';
import { ArticleListPage, ArticleDetail } from './teknav-articles.jsx';
import { CategoryPage, TagPage, GlossaryPage, SearchPage, AuthorsListPage, AuthorProfilePage, SeriesPage, TopicHubPage, NewsletterArchivePage, NewsletterIssuePage, JobsPage, CoursesPage, MembershipPage, MembershipSuccessPage } from './teknav-pages.jsx';
import { LoginPage } from './teknav-auth.jsx';
import { AdminPanel, WriterWorkspace } from './teknav-admin.jsx';
import { UserProfilePage } from './teknav-profile.jsx';
import { SeoManager } from './src/lib/seo.jsx';

function App() {
  const { page } = useNav();

  const route = () => {
    if (page === '/' || page === '') return <HomePage />;
    if (page === '/articles') return <ArticleListPage />;
    if (page.startsWith('/article/')) return <ArticleDetail slug={page.replace('/article/', '')} />;
    if (page.startsWith('/category/')) return <CategoryPage slug={page.replace('/category/', '')} />;
    if (page.startsWith('/tag/')) return <TagPage tag={page.replace('/tag/', '')} />;
    if (page.startsWith('/glossary/')) return <GlossaryPage slug={page.replace('/glossary/', '')} />;
    if (page.startsWith('/topics/')) return <TopicHubPage slug={page.replace('/topics/', '')} />;
    if (page.startsWith('/series/')) return <SeriesPage slug={page.replace('/series/', '')} />;
    if (page === '/newsletter') return <NewsletterArchivePage />;
    if (page === '/jobs') return <JobsPage />;
    if (page === '/courses') return <CoursesPage />;
    if (page === '/membership') return <MembershipPage />;
    if (page.startsWith('/newsletter/')) return <NewsletterIssuePage slug={page.replace('/newsletter/', '')} />;
    if (page === '/search') return <SearchPage />;
    if (page.startsWith('/search?q=')) {
      const q = decodeURIComponent(page.replace('/search?q=', ''));
      return <SearchPage initQ={q} />;
    }
    if (page === '/authors') return <AuthorsListPage />;
    if (page.startsWith('/author/')) return <AuthorProfilePage slug={page.replace('/author/', '')} />;
    if (page.startsWith('/profile/@')) return <UserProfilePage username={page.replace('/profile/@', '')} />;
    if (page === '/login') return <LoginPage />;
    if (page === '/writer') return <WriterWorkspace />;
    if (page === '/admin') return <AdminPanel />;
    // 404
    return (
      <div style={{ paddingTop: 120, textAlign: 'center', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
        <EmptyState title="صفحه یافت نشد" subtitle="آدرس وارد‌شده وجود ندارد" />
      </div>
    );
  };

  const isAdmin = page === '/admin';
  const isLogin = page === '/login';

  return (
    <ToastProvider>
      <AuthProvider>
        <NavProvider>
          <NavConsumer isAdmin={isAdmin} isLogin={isLogin} route={route} />
        </NavProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

function NavConsumer({ isAdmin, isLogin, route }) {
  const { page } = useNav();
  const isAdminPage = page === '/admin';
  const isLoginPage = page === '/login';
  return (
    <>
      {!isAdminPage && !isLoginPage && <Header />}
      <main>{route()}</main>
      {!isAdminPage && !isLoginPage && <Footer />}
    </>
  );
}

// Mount — wrap everything in providers from the outside
function Root() {
  return (
    <NavProvider>
      <AuthProvider>
        <ToastProvider>
          <InnerApp />
        </ToastProvider>
      </AuthProvider>
    </NavProvider>
  );
}

function InnerApp() {
  const { page } = useNav();
  const { user } = useAuth();

  useEffect(() => {
    const report = (payload) => {
      try {
        navigator.sendBeacon?.('/api/errors', new Blob([JSON.stringify(payload)], { type: 'application/json' })) ||
          fetch('/api/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
      } catch {}
    };
    const onError = (event) => report({
      message: event.message || 'window.error',
      source: event.filename,
      stack: event.error?.stack,
      path: window.location.pathname + window.location.hash,
      userAgent: navigator.userAgent,
    });
    const onRejection = (event) => report({
      message: String(event.reason?.message || event.reason || 'unhandledrejection'),
      stack: event.reason?.stack,
      path: window.location.pathname + window.location.hash,
      userAgent: navigator.userAgent,
    });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  const isAdmin = page === '/admin';
  const isLogin = page === '/login';

  const renderPage = () => {
    if (page === '/' || page === '') return <HomePage />;
    if (page === '/articles') return <ArticleListPage />;
    if (page.startsWith('/article/')) return <ArticleDetail slug={page.replace('/article/', '')} />;
    if (page.startsWith('/category/')) return <CategoryPage slug={page.replace('/category/', '')} />;
    if (page.startsWith('/tag/')) return <TagPage tag={page.replace('/tag/', '')} />;
    if (page.startsWith('/glossary/')) return <GlossaryPage slug={page.replace('/glossary/', '')} />;
    if (page.startsWith('/topics/')) return <TopicHubPage slug={page.replace('/topics/', '')} />;
    if (page.startsWith('/series/')) return <SeriesPage slug={page.replace('/series/', '')} />;
    if (page === '/newsletter') return <NewsletterArchivePage />;
    if (page === '/jobs') return <JobsPage />;
    if (page === '/courses') return <CoursesPage />;
    if (page === '/membership') return <MembershipPage />;
    if (page === '/membership/success' || page.startsWith('/membership/success?')) return <MembershipSuccessPage />;
    if (page.startsWith('/newsletter/')) return <NewsletterIssuePage slug={page.replace('/newsletter/', '')} />;
    if (page === '/search') return <SearchPage />;
    if (page.startsWith('/search?q=')) return <SearchPage initQ={decodeURIComponent(page.replace('/search?q=', ''))} />;
    if (page === '/authors') return <AuthorsListPage />;
    if (page.startsWith('/author/')) return <AuthorProfilePage slug={page.replace('/author/', '')} />;
    if (page.startsWith('/profile/@')) return <UserProfilePage username={page.replace('/profile/@', '')} />;
    if (page === '/login') return <LoginPage />;
    if (page === '/writer') return <WriterWorkspace />;
    if (page === '/admin') return <AdminPanel />;
    return (
      <div style={{ paddingTop: 120, textAlign: 'center', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
        <EmptyState title="صفحه یافت نشد" subtitle="آدرس وارد‌شده وجود ندارد" />
      </div>
    );
  };

  return (
    <>
      <SeoManager />
      {!isAdmin && !isLogin && <Header />}
      <main>{renderPage()}</main>
      {!isAdmin && !isLogin && <Footer />}
      <InstallPrompt />
      <PushNotificationPrompt user={user} />
    </>
  );
}

const container = document.getElementById('root');
const reactRoot = createRoot(container);
reactRoot.render(<Root />);
