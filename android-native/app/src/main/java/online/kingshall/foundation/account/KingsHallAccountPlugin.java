package online.kingshall.foundation.account;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.os.Bundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KingsHallAccount")
public class KingsHallAccountPlugin extends Plugin {
    private static final String ACCOUNT_TYPE = "online.kingshall.account";

    @PluginMethod
    public void addAccount(PluginCall call) {
        String email = call.getString("email", "").trim().toLowerCase();
        String username = call.getString("username", "").trim();
        String displayName = call.getString("displayName", "").trim();

        if (email.isEmpty()) {
            call.reject("A verified KingsHall email is required to register the device account.");
            return;
        }

        Account account = new Account(email, ACCOUNT_TYPE);
        AccountManager manager = AccountManager.get(getContext());
        for (Account existing : manager.getAccountsByType(ACCOUNT_TYPE)) {
            if (existing.name.equalsIgnoreCase(email)) {
                JSObject result = new JSObject();
                result.put("accountName", existing.name);
                result.put("alreadyPresent", true);
                call.resolve(result);
                return;
            }
        }

        Bundle userData = new Bundle();
        if (!username.isEmpty()) userData.putString("username", username);
        if (!displayName.isEmpty()) userData.putString("displayName", displayName);

        try {
            boolean added = manager.addAccountExplicitly(account, null, userData);
            if (!added) {
                call.reject("Android did not add the KingsHall device account.");
                return;
            }
            JSObject result = new JSObject();
            result.put("accountName", email);
            result.put("alreadyPresent", false);
            call.resolve(result);
        } catch (SecurityException | IllegalArgumentException error) {
            call.reject("Android blocked device-account registration.", error);
        }
    }
}
