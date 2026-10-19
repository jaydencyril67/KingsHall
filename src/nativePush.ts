import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { alertsFetch } from './alertsClient';

const TOKEN_KEY = 'kh_native_push_token';

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
