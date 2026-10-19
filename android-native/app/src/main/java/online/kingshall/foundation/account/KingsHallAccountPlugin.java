package online.kingshall.foundation.account;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KingsHallAccount")
public class KingsHallAccountPlugin extends Plugin {
    private static final String ACCOUNT_TYPE = "online.kingshall.account";
    private static final String[] COMPANION_PACKAGES = {
            "com.kingshall.exchange",
            "com.kingshall.hallschat"
    };

    @PluginMethod
    public void addAccount(PluginCall call) {
        String email = call.getString("email", "").trim().toLowerCase(java.util.Locale.ROOT);
        String username = call.getString("username", "").trim();
        String displayName = call.getString("displayName", "").trim();
        String refreshToken = call.getString("refreshToken", "").trim();

        if (email.isEmpty()) {
            call.reject("A verified KingsHall email is required to register the device account.");
            return;
        }

        AccountManager manager = AccountManager.get(getContext());
        Account account = new Account(email, ACCOUNT_TYPE);
        try {
            for (Account existing : manager.getAccountsByType(ACCOUNT_TYPE)) {
                if (existing.name.equalsIgnoreCase(email)) {
                    savePrivateIdentity(email, username, displayName);
                    if (!refreshToken.isEmpty()) manager.setPassword(existing, refreshToken);
                    // Keep profile fields out of AccountManager user-data, which is readable by visible apps.
                    manager.setUserData(existing, "username", "");
                    manager.setUserData(existing, "displayName", "");
                    makeCompanionAccountSelectable(manager, existing);
                    JSObject result = new JSObject();
                    result.put("accountName", existing.name);
                    result.put("alreadyPresent", true);
                    call.resolve(result);
                    return;
                }
            }

            // Only the email is the Android account name. No password or session token is stored.
            boolean added = manager.addAccountExplicitly(account, null, null);
            if (!added) {
                call.reject("Android did not add the KingsHall device account.");
                return;
            }
            savePrivateIdentity(email, username, displayName);
            if (!refreshToken.isEmpty()) manager.setPassword(account, refreshToken);
            makeCompanionAccountSelectable(manager, account);

            JSObject result = new JSObject();
            result.put("accountName", email);
            result.put("alreadyPresent", false);
            call.resolve(result);
        } catch (SecurityException | IllegalArgumentException error) {
            call.reject("Android blocked device-account registration.", error);
        }
    }


    // AccountManager keeps this credential outside the app's WebView storage, so
    // clearing the app's data does not automatically discard the saved session.
    @PluginMethod
    public void restoreSession(PluginCall call) {
        AccountManager manager = AccountManager.get(getContext());
        for (Account account : manager.getAccountsByType(ACCOUNT_TYPE)) {
            String refreshToken = manager.getPassword(account);
            if (refreshToken == null || refreshToken.length() < 40) continue;
            JSObject result = new JSObject();
            result.put("email", account.name);
            result.put("refreshToken", refreshToken);
            call.resolve(result);
            return;
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        String email = call.getString("email", "").trim().toLowerCase(java.util.Locale.ROOT);
        AccountManager manager = AccountManager.get(getContext());
        for (Account account : manager.getAccountsByType(ACCOUNT_TYPE)) {
            if (email.isEmpty() || account.name.equalsIgnoreCase(email)) {
                manager.setPassword(account, null);
            }
        }
        call.resolve();
    }

    private void savePrivateIdentity(String email, String username, String displayName) {
        SharedPreferences.Editor editor = getContext()
                .getSharedPreferences(KingsHallAuthenticator.PREFS, android.content.Context.MODE_PRIVATE)
                .edit();
        editor.putString(KingsHallAuthenticator.profileKey(email, KingsHallAuthenticator.KEY_USERNAME), username);
        editor.putString(KingsHallAuthenticator.profileKey(email, KingsHallAuthenticator.KEY_DISPLAY_NAME), displayName);
        editor.apply();
    }

    private void makeCompanionAccountSelectable(AccountManager manager, Account account) {
        for (String packageName : COMPANION_PACKAGES) {
            try {
                manager.setAccountVisibility(account, packageName, AccountManager.VISIBILITY_VISIBLE);
            } catch (RuntimeException ignored) {
                // A companion app may not be installed yet. It can be granted visibility after approval.
            }
        }
    }
}
