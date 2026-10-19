from pathlib import Path
import re

root = Path("android")
if not root.is_dir():
    raise SystemExit("Generated Android project is missing; run Capacitor add/sync first.")

source = Path("android-native/app/src/main/java/online/kingshall/foundation/NativeWebAuthnPlugin.java")
target = root / "app/src/main/java/online/kingshall/foundation/NativeWebAuthnPlugin.java"
if not source.is_file():
    raise SystemExit("NativeWebAuthnPlugin.java source is missing.")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(source.read_text())

main = root / "app/src/main/java/online/kingshall/foundation/MainActivity.java"
if not main.is_file():
    raise SystemExit("Generated MainActivity.java was not found.")
text = main.read_text()
if "NativeWebAuthnPlugin.class" not in text:
    if "import online.kingshall.foundation.NativeWebAuthnPlugin;" not in text:
        text = text.replace("import com.getcapacitor.BridgeActivity;", "import com.getcapacitor.BridgeActivity;\nimport online.kingshall.foundation.NativeWebAuthnPlugin;")
    marker = "public class MainActivity extends BridgeActivity {"
    if marker not in text:
        raise SystemExit("Could not find MainActivity class declaration.")
    text = text.replace(marker, marker + "\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(NativeWebAuthnPlugin.class);\n        super.onCreate(savedInstanceState);\n    }", 1)
    main.write_text(text)

gradle = root / "app/build.gradle"
g = gradle.read_text()
marker = "dependencies {"
start = g.find(marker)
end = g.find("}", start) if start >= 0 else -1
if end < 0:
    raise SystemExit("Could not find Android app dependencies block.")
additions = []
for dep in [
    "implementation 'androidx.credentials:credentials:1.5.0'",
    "implementation 'androidx.credentials:credentials-play-services-auth:1.5.0'"
]:
    if dep not in g:
        additions.append("    " + dep)
if additions:
    g = g[:end] + "\n" + "\n".join(additions) + "\n" + g[end:]
    gradle.write_text(g)
print("Installed KingsHall native passkey plugin and Credential Manager dependencies.")
