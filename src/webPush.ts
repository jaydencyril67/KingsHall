import { alertsFetch } from './alertsClient';

const WEB_ENDPOINT_KEY = 'kh_web_push_endpoint';

function decodeVapidKey(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const raw = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function registerKingsHallWebPushSubscription(): Promise<string> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Browser push is not supported by this browser. Open KingsHall in a supported browser or installed PWA.');
  }

  let permission = Notification.permission;
  if (permission !== 'granted') permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Allow browser notifications to enable KingsHall push alerts.');

  const keyResponse = await alertsFetch('/api/alerts/web-push-key', { cache: 'no-store' });
  const config = await keyResponse.json().catch(() => ({})) as { publicKey?: string | null; configured?: boolean; error?: string };
  if (!keyResponse.ok || !config.publicKey || config.configured !== true) {
    throw new Error(config.error || 'KingsHall browser push needs the VAPID public and private keys configured on the API first.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(config.publicKey),
    });
  }

  const response = await alertsFetch('/api/alerts/web-push-subscription', {
    method: 'POST',
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) throw new Error(payload.error || payload.message || 'Unable to register this browser for KingsHall push alerts.');

  localStorage.setItem(WEB_ENDPOINT_KEY, subscription.endpoint);
  return subscription.endpoint;
}

export async function unregisterKingsHallWebPushSubscription(): Promise<void> {
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
  const subscription = await registration?.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || localStorage.getItem(WEB_ENDPOINT_KEY);

  if (endpoint) {
    const response = await alertsFetch('/api/alerts/web-push-subscription', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      throw new Error(payload.error || payload.message || 'Unable to remove this browser from KingsHall push alerts.');
    }
  }
  if (subscription) await subscription.unsubscribe().catch(() => false);
  localStorage.removeItem(WEB_ENDPOINT_KEY);
}
