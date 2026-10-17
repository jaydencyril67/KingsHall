package online.kingshall.foundation;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeAppUpdate")
public class NativeAppUpdatePlugin extends Plugin {
    private BroadcastReceiver downloadReceiver;
    private long pendingDownloadId = -1L;

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= 28 ? (double) info.getLongVersionCode() : (double) info.versionCode);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to read the installed KingsHall version.", error);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        Uri parsed = url == null ? null : Uri.parse(url);
        if (parsed == null || !"https".equalsIgnoreCase(parsed.getScheme()) ||
                !"api.kingshall.online".equalsIgnoreCase(parsed.getHost()) ||
                !"/api/notifications/apk-download".equals(parsed.getPath())) {
            call.reject("The update URL is not a trusted KingsHall APK endpoint.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(settings);
            JSObject result = new JSObject();
            result.put("requiresPermission", true);
            call.resolve(result);
            return;
        }

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            call.reject("Android's download service is unavailable.");
            return;
        }

        try {
            if (downloadReceiver != null) {
                try { getContext().unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
                downloadReceiver = null;
            }

            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            downloadReceiver = new BroadcastReceiver() {
                @Override public void onReceive(Context context, Intent intent) {
                    long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                    if (completedId != pendingDownloadId) return;
                    try { getContext().unregisterReceiver(this); } catch (Exception ignored) {}
                    downloadReceiver = null;

                    DownloadManager.Query query = new DownloadManager.Query().setFilterById(completedId);
                    android.database.Cursor cursor = null;
                    int status = -1;
                    try {
                        cursor = manager.query(query);
                        if (cursor != null && cursor.moveToFirst()) {
                            int index = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                            if (index >= 0) status = cursor.getInt(index);
                        }
                    } finally {
                        if (cursor != null) cursor.close();
                    }
                    if (status != DownloadManager.STATUS_SUCCESSFUL) {
                        JSObject failure = new JSObject();
                        failure.put("message", "The KingsHall APK download failed. Check your connection and try again.");
                        notifyListeners("downloadError", failure);
                        return;
                    }

                    Uri apkUri = manager.getUriForDownloadedFile(completedId);
                    if (apkUri == null) {
                        JSObject failure = new JSObject();
                        failure.put("message", "Android could not locate the downloaded KingsHall APK.");
                        notifyListeners("downloadError", failure);
                        return;
                    }
                    Intent install = new Intent(Intent.ACTION_VIEW);
                    install.setDataAndType(apkUri, "application/vnd.android.package-archive");
                    install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        getActivity().startActivity(install);
                    } catch (Exception error) {
                        JSObject failure = new JSObject();
                        failure.put("message", "Android could not open the KingsHall installer: " + String.valueOf(error.getMessage()));
                        notifyListeners("downloadError", failure);
                    }
                }
            };

            if (Build.VERSION.SDK_INT >= 33) {
                getContext().registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(downloadReceiver, filter);
            }

            DownloadManager.Request request = new DownloadManager.Request(parsed);
            request.setTitle("KingsHall APK");
            request.setDescription("Downloading the latest KingsHall update");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "KingsHall.apk");
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            pendingDownloadId = manager.enqueue(request);

            JSObject result = new JSObject();
            result.put("status", "queued");
            result.put("downloadId", pendingDownloadId);
            result.put("url", url);
            result.put("queuedAt", System.currentTimeMillis());
            call.resolve(result);
        } catch (Exception error) {
            if (downloadReceiver != null) {
                try { getContext().unregisterReceiver(downloadReceiver); } catch (Exception ignored) {}
                downloadReceiver = null;
            }
            call.reject("Unable to start the KingsHall APK download.", error);
        }
    }
}