import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { alertsFetch } from './alertsClient';

const TOKEN_KEY = 'kh_native_push_token';
const WEB_ENDPOINT_KEY = 'kh_web_push_endpoint';

function decodeVapidKey(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const raw = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function registerKingsHallWebPushSubscription(): Promise<string> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Browser push is not supported by this browser. Try installing/opening the PWA in a supported browser.');
  }
  let permission = Notification.permission;
  if (permission !== 'granted') permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Allow browser notifications to enable KingsHall push alerts.');

  const configResponse = await alertsFetch('/api/alerts/web-push-key', { cache: 'no-store' });
  const config = await configResponse.json().catch(() => ({})) as { publicKey?: string | null; configured?: boolean; error?: string };
  if (!configResponse.ok || !config.publicKey || config.configured !== true) {
    throw new Error(config.error || 'Browser push needs the VAPID public and private keys configured on the KingsHall API first.');
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

export async function registerKingsHallNativePushToken(requestPermission: boolean): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    if (requestPermission) {
      throw new Error('Firebase push notifications are available in the KingsHall Android app.');
    }
    return null;
  }

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive !== 'granted' && requestPermission) {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') {
    if (requestPermission) {
      throw new Error('Allow notifications for KingsHall in Android settings to enable push alerts.');
    }
    return null;
  }

  await PushNotifications.createChannel({
    id: 'kingshall_alerts',
    name: 'KingsHall Alerts',
    importance: 5,
    sound: 'default',
  });

  const fcmToken = await new Promise<string>(async (resolve, reject) => {
    let settled = false;
    let registrationListener: { remove: () => Promise<void> } | undefined;
    let errorListener: { remove: () => Promise<void> } | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      void registrationListener?.remove();
      void errorListener?.remove();
      callback();
    };

    try {
      registrationListener = await PushNotifications.addListener('registration', result => {
        if (!result.value) {
          finish(() => reject(new Error('Android returned an empty Firebase push token.')));
          return;
        }
        finish(() => resolve(result.value));
      });
      errorListener = await PushNotifications.addListener('registrationError', error => {
        finish(() => reject(new Error(error.error || 'Android could not register this device for push notifications.')));
      });
      await PushNotifications.register();
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error('Android push registration failed.')));
    }
  });

  const response = await alertsFetch('/api/alerts/native-push-token', {
    method: 'POST',
    body: JSON.stringify({ token: fcmToken }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Unable to register this Android device for push alerts.');
  }

  localStorage.setItem(TOKEN_KEY, fcmToken);
  return fcmToken;
}

export async function unregisterKingsHallNativePushToken(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  const response = await alertsFetch('/api/alerts/native-push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(payload.error || payload.message || 'Unable to remove this Android device from push alerts.');
  }

  localStorage.removeItem(TOKEN_KEY);
}
