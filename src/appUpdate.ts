import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';

const BUILD_STORAGE_KEY = 'lletrimon:build-id';
const RELOAD_STORAGE_KEY = 'lletrimon:reloaded-build-id';
const APP_SCOPE_SEGMENT = import.meta.env.BASE_URL || '/';

async function clearApplicationCaches() {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  const scopeToken = APP_SCOPE_SEGMENT.replace(/^\/+|\/+$/g, '');
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.includes('workbox') || (scopeToken ? cacheName.includes(scopeToken) : false) || cacheName.includes('lletrimon'))
      .map((cacheName) => caches.delete(cacheName)),
  );
}

async function unregisterApplicationServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) => registration.scope.includes(APP_SCOPE_SEGMENT))
      .map((registration) => registration.unregister()),
  );
}

async function hardRefreshApplication() {
  await clearApplicationCaches();
  await unregisterApplicationServiceWorkers();
  window.location.reload();
}

async function syncPublishedBuild() {
  const previousBuildId = localStorage.getItem(BUILD_STORAGE_KEY);
  if (previousBuildId === __APP_BUILD_ID__) {
    return;
  }

  localStorage.setItem(BUILD_STORAGE_KEY, __APP_BUILD_ID__);

  if (!previousBuildId) {
    return;
  }

  if (sessionStorage.getItem(RELOAD_STORAGE_KEY) === __APP_BUILD_ID__) {
    return;
  }

  sessionStorage.setItem(RELOAD_STORAGE_KEY, __APP_BUILD_ID__);
  await hardRefreshApplication();
}

export function initializeAppUpdateFlow() {
  if (__NATIVE_BUILD__ || Capacitor.isNativePlatform()) {
    return;
  }

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void clearApplicationCaches().then(() => updateServiceWorker(true));
    },
    onRegisteredSW(_swUrl, registration) {
      void registration?.update();
    },
    onRegisterError(error) {
      console.error('PWA registration failed:', error);
    },
  });

  void syncPublishedBuild();
}