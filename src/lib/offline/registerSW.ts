// Safe Service Worker registration: skips dev, preview iframes, and Lovable preview hosts.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.endsWith(".sandbox.lovable.dev");

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  if (isPreviewHost || isInIframe) {
    // Cleanup any leftover SW from previous visits
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore */
    });
  });
}

// Helpers shared with push subscription
export async function getRegistration() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.getRegistration();
}
