<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { defineAsyncComponent } from 'vue';
import DashboardSkeleton from './components/DashboardSkeleton.vue';

const WallDisplay = defineAsyncComponent(() => import('./WallDisplay.vue'));
const initialLoading = ref(true);
const routeLoading = ref(false);
const showInitialSkeleton = ref(true);
const wallMode = ref(false);
let stopCurrentPage: (() => void) | undefined;
let pageGeneration = 0;

function isPortalPath(path: string) {
  return path === '/' || path === '/app' || path === '/app/' || /^\/admin(?:\/|$)/.test(path);
}

async function mountCurrentPage() {
  stopCurrentPage?.();
  stopCurrentPage = undefined;
  const generation = ++pageGeneration;
  routeLoading.value = initialLoading.value ? false : true;
  const path = location.pathname;
  if (!isPortalPath(path)) { pageReady(); return; }
  wallMode.value = path === '/' || new URLSearchParams(location.search).get('view') === 'wall';
  if (wallMode.value) { stopCurrentPage = undefined; return; }
  try {
    if (/^\/admin(?:\/|$)/.test(path)) {
      const admin = await import('./admin');
      if (generation !== pageGeneration) return;
      stopCurrentPage = admin.stopAdmin;
      const { startAdmin } = admin;
      await startAdmin();
    } else {
      const dashboard = await import('./dashboard');
      if (generation !== pageGeneration) return;
      stopCurrentPage = dashboard.stopDashboard;
      const { startDashboard } = dashboard;
      await startDashboard();
    }
  } catch (error) {
    if (generation !== pageGeneration) return;
    console.error('Could not mount KinBoard page', error);
    const root = document.querySelector<HTMLElement>('#kinboard-page');
    if (root) root.innerHTML = '<main class="gate"><h1>Couldn’t open this page.</h1><p>Please try again in a moment.</p><button class="primary" onclick="location.reload()">Try again</button></main>';
    pageReady();
  }
}

function pageReady() {
  initialLoading.value = false;
  routeLoading.value = false;
  showInitialSkeleton.value = false;
  document.querySelector('#kinboard-page')?.setAttribute('aria-busy', 'false');
}

function onPopState() { void mountCurrentPage(); }
function onClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!target || target.target || target.hasAttribute('download')) return;
  const url = new URL(target.href, location.href);
  if (url.origin !== location.origin || !isPortalPath(url.pathname)) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  if (url.href === location.href) { event.preventDefault(); return; }
  event.preventDefault();
  if (url.href !== location.href) history.pushState({}, '', url);
  void mountCurrentPage();
}

onMounted(() => {
  try { document.documentElement.dataset.theme = localStorage.getItem('kinboard-theme') === 'dark' ? 'dark' : 'light'; } catch { /* Storage can be disabled by browser policy. */ }
  document.addEventListener('click', onClick);
  window.addEventListener('popstate', onPopState);
  window.addEventListener('kinboard:ready', pageReady);
  void mountCurrentPage();
});
onBeforeUnmount(() => {
  stopCurrentPage?.();
  document.removeEventListener('click', onClick);
  window.removeEventListener('popstate', onPopState);
  window.removeEventListener('kinboard:ready', pageReady);
});
</script>

<template>
  <div class="kinboard-app" :aria-busy="initialLoading || routeLoading">
    <div v-if="routeLoading" class="route-progress" aria-hidden="true"></div>
    <DashboardSkeleton v-if="showInitialSkeleton" />
    <WallDisplay v-if="wallMode" v-show="!initialLoading" />
    <div id="kinboard-page" v-show="!initialLoading && !wallMode"></div>
  </div>
</template>
