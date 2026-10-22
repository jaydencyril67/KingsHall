package online.kingshall.foundation;

import android.content.pm.PackageInfo;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reads the installed KingsHall version for update notifications.
 * APK downloads and installation are exclusively handled by CrownStore.
 */
@CapacitorPlugin(name = "NativeAppUpdate")
public class NativeAppUpdatePlugin extends Plugin {
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
}
