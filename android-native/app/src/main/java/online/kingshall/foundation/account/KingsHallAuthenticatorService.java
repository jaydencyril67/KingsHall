package online.kingshall.foundation.account;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

public class KingsHallAuthenticatorService extends Service {
    private KingsHallAuthenticator authenticator;

    @Override
    public void onCreate() {
        super.onCreate();
        authenticator = new KingsHallAuthenticator(this);
    }

    @Override
    public IBinder onBind(Intent intent) {
        if (intent != null && "android.accounts.AccountAuthenticator".equals(intent.getAction())) {
            return authenticator.getIBinder();
        }
        return null;
    }
}
