import './style.css';
if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
  const { startAdmin } = await import('./admin');
  await startAdmin();
} else {
  await import('./dashboard');
}
