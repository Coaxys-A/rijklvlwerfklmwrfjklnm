// Vite entry — imports global CSS (with @font-face) and the app root.
import './styles/global.css';
import '../teknav-app.jsx';

// Dismiss the splash loader once React has painted its first content.
queueMicrotask(() => {
  const root = document.getElementById('root');
  if (!root) return;
  if (root.children.length > 0) {
    window.__doneLoading?.();
    return;
  }
  const obs = new MutationObserver(() => {
    if (root.children.length > 0) {
      window.__doneLoading?.();
      obs.disconnect();
    }
  });
  obs.observe(root, { childList: true, subtree: true });
  setTimeout(() => { window.__doneLoading?.(); obs.disconnect(); }, 3500);
});
