export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = new URL('service-worker.js', window.location.href).toString();
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => console.log('service worker registered', reg.scope))
        .catch((err) => console.error('service worker registration failed', err));
    });
  }
}
