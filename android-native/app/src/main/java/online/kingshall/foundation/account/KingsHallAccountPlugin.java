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
        Bundle userData = new Bundle();
        if (!username.isEmpty()) userData.putString("username", username);
        if (!displayName.isEmpty()) userData.putString("displayName", displayName);

        try {
            boolean added = manager.addAccountExplicitly(account, null, userData);
            JSObject result = new JSObject();
            result.put("accountName", email);
            result.put("alreadyPresent", !added && manager.getPassword(account) == null
                    && manager.getUserData(account, "username") != null);
            if (!added && !manager.getAccountsByType(ACCOUNT_TYPE).toString().contains(email)) {
                call.reject("Android could not register the KingsHall device account.");
                return;
            }
            call.resolve(result);
        } catch (SecurityException | IllegalArgumentException error) {
            call.reject("Android blocked device-account registration.", error);
        }
    }
}
