from pathlib import Path
import re
import shutil

root = Path("android")
if not root.is_dir():
    raise SystemExit("Generated Android project is missing; run Capacitor add/sync first.")

source = Path("android-native/app/src/main/java/online/kingshall/foundation/NativeAppUpdatePlugin.java")
target_root = root / "app/src/main"
target = target_root / "java/online/kingshall/foundation/NativeAppUpdatePlugin.java"
if not source.is_file():
    raise SystemExit("Native KingsHall version-reader source is missing.")
target.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source, target)

# Remove the install permission left by older generated APK downloader builds.
manifest_path = target_root / "AndroidManifest.xml"
manifest = manifest_path.read_text(encoding="utf-8")
manifest = re.sub(
    r'\s*<uses-permission\s+android:name="android.permission.REQUEST_INSTALL_PACKAGES"\s*/>',
    "",
    manifest,
)
manifest_path.write_text(manifest, encoding="utf-8")

activity_path = target_root / "java/online/kingshall/foundation/MainActivity.java"
if not activity_path.exists():
    raise SystemExit("Expected generated MainActivity.java was not found.")
activity = activity_path.read_text(encoding="utf-8")
plugin_import = "import online.kingshall.foundation.NativeAppUpdatePlugin;"
if plugin_import not in activity:
    marker = "import com.getcapacitor.BridgeActivity;"
    if marker not in activity:
        raise SystemExit("Could not safely locate BridgeActivity import.")
    activity = activity.replace(marker, marker + "\n" + plugin_import, 1)

registration = "registerPlugin(NativeAppUpdatePlugin.class);"
if registration not in activity:
    marker = "super.onCreate(savedInstanceState);"
    if marker not in activity:
        raise SystemExit("Could not safely locate MainActivity onCreate.")
    activity = activity.replace(marker, registration + "\n        " + marker, 1)

activity_path.write_text(activity, encoding="utf-8")
print("Installed KingsHall native version reader for update notifications; no APK download or installer.")
