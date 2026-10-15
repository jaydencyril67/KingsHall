# KingsHall

Fresh frontend foundation built with **Vite + React + TypeScript**, with a minimal Capacitor Android wrapper for staged APK testing.

## Frontend commands
- `npm install` — install dependencies
- `npm run dev` — start Vite
- `npm run build` — type-check and build production assets

## Signed Android APK
The GitHub Actions workflow **KingsHall Signed Production APK** builds a **release APK signed with a persistent keystore**. It no longer builds or uploads the diagnostic debug APK. Run it manually from **Actions → KingsHall Signed Production APK → Run workflow** or let a relevant change on `main` trigger it.

Before the first run, add these four **repository Actions secrets** under **Settings → Secrets and variables → Actions**:
- `ANDROID_KEYSTORE_BASE64` — the release keystore file encoded as one Base64 string
- `ANDROID_KEYSTORE_PASSWORD` — the keystore password
- `ANDROID_KEY_ALIAS` — the key alias inside the keystore
- `ANDROID_KEY_PASSWORD` — the key password

Keep the keystore and passwords private. Never commit the keystore or put passwords in source code. Back up the keystore securely: future APK updates must use the same signing key. Secrets saved in another repository are not automatically available to KingsHall.

After a successful run, download the `KingsHall-production-signed-apk` artifact. The generated Android wrapper is built in CI and is not committed as a pre-generated Android project.

The app uses the separate package ID `online.kingshall.foundation` so this clean test can be distinguished from previous KingsHall APKs.

## Android device account (initial stage)
- After a successful KingsHall sign-in in the Android app, the native Capacitor bridge registers the user's email as an Android `AccountManager` account with account type `online.kingshall.account`.
- The account authenticator is installed into the generated Android project by `scripts/install-android-account-provider.py` during the release workflow.
- Only the email, username, and display name are kept as account metadata. The user's password and API tokens are not stored in Android AccountManager.
- This stage does not provide authentication tokens to CryBots, HallsChat, or other apps. The authenticator explicitly does not issue cross-app tokens.
- Android permits separate accounts with different names; AccountManager naturally treats the same account type/name pair as one account.

The web frontend uses the separate ApiKingsHall backend for sign-up, email verification, and sign-in. A signed release build is not the same as a Google Play-distributed app; Play Protect may still show a first-time developer warning, and signing alone does not guarantee approval.
