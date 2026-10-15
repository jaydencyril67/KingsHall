package online.kingshall.foundation.account;

import android.accounts.Account;
import android.accounts.AccountAuthenticatorResponse;
import android.accounts.AccountManager;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;

public class KingsHallIdentityConsentActivity extends Activity {
    private AccountAuthenticatorResponse response;
    private String accountName;
    private String accountType;
    private String callerPackage;
    private String callerDigest;
    private String tokenType;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        response = getIntent().getParcelableExtra(AccountManager.KEY_ACCOUNT_AUTHENTICATOR_RESPONSE);
        accountName = getIntent().getStringExtra("accountName");
        accountType = getIntent().getStringExtra("accountType");
        callerPackage = getIntent().getStringExtra("callerPackage");
        callerDigest = getIntent().getStringExtra("callerSigningDigest");
        tokenType = getIntent().getStringExtra("authTokenType");

        if (response == null || accountName == null || !KingsHallAuthenticator.ACCOUNT_TYPE.equals(accountType)
                || !KingsHallAuthenticator.isAllowedPackage(callerPackage)) {
            finishWithError("Invalid identity permission request.");
            return;
        }

        try {
            String actualDigest = KingsHallAuthenticator.signingDigest(this, callerPackage);
            if (!actualDigest.equals(callerDigest)
                    || !(KingsHallAuthenticator.TOKEN_PREFIX + callerPackage + ":" + actualDigest).equals(tokenType)) {
                finishWithError("The requesting app's signing identity changed. Please reopen the app and try again.");
                return;
            }

            ApplicationInfo appInfo = getPackageManager().getApplicationInfo(callerPackage, 0);
            CharSequence appLabel = getPackageManager().getApplicationLabel(appInfo);
            String message = appLabel + " (" + callerPackage + ") is requesting access to this KingsHall account's email, username and display name for identity autofill. No password or login session will be shared. Allow this app on this device?";
            new AlertDialog.Builder(this)
                    .setTitle("Share KingsHall identity?")
                    .setMessage(message)
                    .setCancelable(false)
                    .setNegativeButton("Not now", (dialog, which) -> finishWithError("Identity access was not approved."))
                    .setPositiveButton("Allow", (dialog, which) -> approve())
                    .setOnCancelListener(dialog -> finishWithError("Identity access was not approved."))
                    .show();
        } catch (Exception e) {
            finishWithError("KingsHall could not verify the requesting app.");
        }
    }

    private void approve() {
        try {
            String actualDigest = KingsHallAuthenticator.signingDigest(this, callerPackage);
            if (!actualDigest.equals(callerDigest)) {
                finishWithError("The requesting app changed during approval.");
                return;
            }

            getSharedPreferences(KingsHallAuthenticator.TRUST_PREFS, MODE_PRIVATE)
                    .edit().putString(KingsHallAuthenticator.trustKey(callerPackage, accountName), actualDigest).apply();
            Account account = new Account(accountName, accountType);
            Bundle result = KingsHallAuthenticator.identityResult(this, account, callerPackage, tokenType);
            response.onResult(result);
            response = null;
            finish();
        } catch (Exception e) {
            finishWithError("KingsHall could not grant identity access.");
        }
    }

    private void finishWithError(String message) {
        if (response != null) {
            try { response.onError(AccountManager.ERROR_CODE_CANCELED, message); } catch (Exception ignored) {}
            response = null;
        }
        finish();
    }
}
