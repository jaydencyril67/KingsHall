from pathlib import Path
import shutil

root = Path("android")
if not root.is_dir():
    raise SystemExit("Generated Android project is missing; run Capacitor add/sync first.")

source_root = Path("android-native/app/src/main")
target_root = root / "app/src/main"

for relative in (
    "java/online/kingshall/foundation/account/KingsHallAccountPlugin.java",
    "java/online/kingshall/foundation/account/KingsHallAuthenticator.java",
    "java/online/kingshall/foundation/account/KingsHallAuthenticatorService.java",
    "res/xml/kingshall_authenticator.xml",
):
    source = source_root / relative
    target = target_root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)

manifest_path = target_root / "AndroidManifest.xml"
manifest = manifest_path.read_text(encoding="utf-8")
permission = '    <uses-permission android:name="android.permission.AUTHENTICATE_ACCOUNTS" />'
if "android.permission.AUTHENTICATE_ACCOUNTS" not in manifest:
    manifest = manifest.replace("<application", permission + "\n\n    <application", 1)

service = """        <service
            android:name=".account.KingsHallAuthenticatorService"
            android:exported="true"
            android:permission="android.permission.BIND_ACCOUNT_AUTHENTICATOR">
            <intent-filter>
                <action android:name="android.accounts.AccountAuthenticator" />
            </intent-filter>
            <meta-data
                android:name="android.accounts.AccountAuthenticator"
                android:resource="@xml/kingshall_authenticator" />
        </service>
"""
if "KingsHallAuthenticatorService" not in manifest:
    manifest = manifest.replace("</application>", service + "    </application>", 1)
manifest_path.write_text(manifest, encoding="utf-8")

strings_path = target_root / "res/values/strings.xml"
strings = strings_path.read_text(encoding="utf-8")
if "kingshall_account_label" not in strings:
    strings = strings.replace("</resources>", '    <string name="kingshall_account_label">KingsHall</string>\n</resources>')
    strings_path.write_text(strings, encoding="utf-8")

activity_path = target_root / "java/online/kingshall/foundation/MainActivity.java"
if not activity_path.exists():
    raise SystemExit("Expected generated MainActivity.java was not found.")
activity = activity_path.read_text(encoding="utf-8")
if "KingsHallAccountPlugin" not in activity:
    activity = activity.replace(
        "import com.getcapacitor.BridgeActivity;",
        "import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n"
        "import online.kingshall.foundation.account.KingsHallAccountPlugin;"
    )
    activity = activity.replace(
        "public class MainActivity extends BridgeActivity {}",
        """public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KingsHallAccountPlugin.class);
        super.onCreate(savedInstanceState);
    }
}"""
    )
    if "KingsHallAccountPlugin" not in activity or "registerPlugin(" not in activity:
        raise SystemExit("Could not safely register KingsHallAccountPlugin in MainActivity.")
    activity_path.write_text(activity, encoding="utf-8")

print("Installed KingsHall Android AccountManager authenticator and Capacitor bridge.")
