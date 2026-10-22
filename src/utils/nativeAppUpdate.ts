import { registerPlugin } from '@capacitor/core';

export type NativeAppInfo = {
  versionName: string;
  versionCode: number;
};

export type NativeAppUpdatePlugin = {
  // Version metadata is retained for this app's update-notification checks.
  // APK downloads and installation are handled exclusively by CrownStore.
  getAppInfo(): Promise<NativeAppInfo>;
};

export const NativeAppUpdate = registerPlugin<NativeAppUpdatePlugin>('NativeAppUpdate');
