package online.kingshall.foundation.account;

import android.accounts.AbstractAccountAuthenticator;
import android.accounts.Account;
import android.accounts.AccountAuthenticatorResponse;
import android.accounts.AccountManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Bundle;

import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;

public class KingsHallAuthenticator extends AbstractAccountAuthenticator {
    static final String ACCOUNT_TYPE = "online.kingshall.account";
    static final String TOKEN_PREFIX = "online.kingshall.identity.read:";
    static final String PREFS = "kingshall_identity_private";
    static final String TRUST_PREFS = "kingshall_identity_trust";
    static final String KEY_USERNAME = "username";
    static final String KEY_DISPLAY_NAME = "displayName";

    private final Context context;

    public KingsHallAuthenticator(Context context) {
        super(context);
        this.context = context.getApplicationContext();
    }

    static boolean isAllowedPackage(String packageName) {
        return "com.kingshall.exchange".equals(packageName)
                || "com.kingshall.hallschat".equals(packageName)
                || "online.kingshall.crownstore".equals(packageName);
    }

    static String profileKey(String email, String field) {
        return "profile:" + sha256(email.trim().toLowerCase(Locale.ROOT)) + ":" + field;
    }

    static String trustKey(String packageName, String email) {
        return "trusted:" + packageName + ":" + profileKey(email, "account");
    }

    static String signingDigest(Context context, String packageName) throws Exception {
        PackageManager pm = context.getPackageManager();
        PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
        SigningInfo signingInfo = info.signingInfo;
        if (signingInfo == null) throw new SecurityException("App signing information is unavailable.");
        Signature[] signatures = signingInfo.getApkContentsSigners();
        if (signatures == null || signatures.length != 1) {
            throw new SecurityException("Only a single current app signing certificate is supported.");
        }
        return sha256(signatures[0].toByteArray());
    }

    private static String sha256(String value) {
        try {
            return sha256(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String sha256(byte[] value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value);
        StringBuilder out = new StringBuilder(digest.length * 2);
        for (byte b : digest) out.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return out.toString();
    }

    static Bundle identityResult(Context context, Account account, String packageName, String tokenType) {
        AccountManager manager = AccountManager.get(context);
        String token = UUID.randomUUID().toString();
        manager.setAccountVisibility(account, packageName, AccountManager.VISIBILITY_VISIBLE);
        manager.setAuthToken(account, tokenType, token);

        Bundle result = new Bundle();
        result.putString(AccountManager.KEY_ACCOUNT_NAME, account.name);
        result.putString(AccountManager.KEY_ACCOUNT_TYPE, account.type);
        result.putString(AccountManager.KEY_AUTHTOKEN, token);
        android.content.SharedPreferences profile = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        result.putString(KEY_USERNAME, profile.getString(profileKey(account.name, KEY_USERNAME), ""));
        result.putString(KEY_DISPLAY_NAME, profile.getString(profileKey(account.name, KEY_DISPLAY_NAME), ""));
        result.putString("identityScope", "identity.read");
        result.putString("authorizedPackage", packageName);
        return result;
    }

    @Override
    public Bundle editProperties(AccountAuthenticatorResponse response, String accountType) {
        return error("KingsHall account settings are managed in the KingsHall app.");
    }

    @Override
    public Bundle addAccount(AccountAuthenticatorResponse response, String accountType,
                             String authTokenType, String[] requiredFeatures, Bundle options) {
        return error("Open KingsHall and sign in to add your account to this device.");
    }

    @Override
    public Bundle confirmCredentials(AccountAuthenticatorResponse response, Account account,
                                     Bundle options) {
        return error("Please open KingsHall to confirm your account.");
    }

    @Override
    public Bundle getAuthToken(AccountAuthenticatorResponse response, Account account,
                               String authTokenType, Bundle options) {
        if (account == null || !ACCOUNT_TYPE.equals(account.type) || authTokenType == null || options == null) {
            return error("Invalid KingsHall identity request.");
        }

        String packageName = options.getString(AccountManager.KEY_ANDROID_PACKAGE_NAME, "");
        int callerUid = options.getInt(AccountManager.KEY_CALLER_UID, -1);
        if (!isAllowedPackage(packageName)) {
            return error("This app is not approved to request KingsHall identity details.");
        }

        try {
            int installedUid = context.getPackageManager().getApplicationInfo(packageName, 0).uid;
            if (callerUid >= 0 && callerUid != installedUid) {
                return error("The requesting app identity could not be verified.");
            }

            String actualDigest = signingDigest(context, packageName);
            String expectedTokenType = TOKEN_PREFIX + packageName + ":" + actualDigest;
            if (!expectedTokenType.equals(authTokenType)) {
                return error("The requesting app's signing identity does not match this request.");
            }

            String trustedDigest = context.getSharedPreferences(TRUST_PREFS, Context.MODE_PRIVATE)
                    .getString(trustKey(packageName, account.name), "");
            if (!actualDigest.equals(trustedDigest)) {
                Intent intent = new Intent(context, KingsHallIdentityConsentActivity.class);
                intent.putExtra(AccountManager.KEY_ACCOUNT_AUTHENTICATOR_RESPONSE, response);
                intent.putExtra("accountName", account.name);
                intent.putExtra("accountType", account.type);
                intent.putExtra("callerPackage", packageName);
                intent.putExtra("callerSigningDigest", actualDigest);
                intent.putExtra("authTokenType", authTokenType);
                Bundle result = new Bundle();
                result.putParcelable(AccountManager.KEY_INTENT, intent);
                return result;
            }

            return identityResult(context, account, packageName, authTokenType);
        } catch (PackageManager.NameNotFoundException e) {
            return error("The requesting app is not installed.");
        } catch (Exception e) {
            return error("KingsHall could not verify the requesting app.");
        }
    }

    @Override
    public String getAuthTokenLabel(String authTokenType) {
        return "KingsHall identity details";
    }

    @Override
    public Bundle updateCredentials(AccountAuthenticatorResponse response, Account account,
                                    String authTokenType, Bundle options) {
        return error("Open KingsHall to manage your account.");
    }

    @Override
    public Bundle hasFeatures(AccountAuthenticatorResponse response, Account account,
                              String[] features) {
        Bundle result = new Bundle();
        result.putBoolean(AccountManager.KEY_BOOLEAN_RESULT, false);
        return result;
    }

    @Override
    public Bundle getAccountRemovalAllowed(AccountAuthenticatorResponse response, Account account) {
        Bundle result = new Bundle();
        result.putBoolean(AccountManager.KEY_BOOLEAN_RESULT, true);
        return result;
    }

    private Bundle error(String message) {
        Bundle result = new Bundle();
        result.putInt(AccountManager.KEY_ERROR_CODE, 1);
        result.putString(AccountManager.KEY_ERROR_MESSAGE, message);
        return result;
    }
}
