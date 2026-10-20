package online.kingshall.foundation;

import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import androidx.credentials.CreatePublicKeyCredentialRequest;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePublicKeyCredentialResponse;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.PublicKeyCredential;
import androidx.credentials.GetPublicKeyCredentialOption;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "NativeWebAuthn")
public class NativeWebAuthnPlugin extends Plugin {
    private CredentialManager credentialManager;
    private final Executor mainExecutor = command -> new Handler(Looper.getMainLooper()).post(command);

    @Override
    public void load() {
        super.load();
        credentialManager = CredentialManager.create(getContext());
    }

    @PluginMethod
    public void create(PluginCall call) {
        String options = call.getString("options");
        if (options == null || options.trim().isEmpty()) {
            call.reject("Passkey registration options are missing.");
            return;
        }
        CreatePublicKeyCredentialRequest request;
        try {
            request = new CreatePublicKeyCredentialRequest(options);
        } catch (Exception error) {
            call.reject("Invalid passkey registration options.", error);
            return;
        }
        CancellationSignal cancellation = new CancellationSignal();
        call.setKeepAlive(true);
        credentialManager.createCredentialAsync(
            getActivity(), request, cancellation, mainExecutor,
            new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override
                public void onResult(CreateCredentialResponse response) {
                    if (!(response instanceof CreatePublicKeyCredentialResponse)) {
                        call.reject("Android did not return a public-key credential response.");
                        return;
                    }
                    CreatePublicKeyCredentialResponse publicKeyResponse = (CreatePublicKeyCredentialResponse) response;
                    JSObject result = new JSObject();
                    result.put("responseJson", publicKeyResponse.getRegistrationResponseJson());
                    call.resolve(result);
                }
                @Override
                public void onError(CreateCredentialException error) {
                    call.reject(error.getMessage() == null ? "Passkey registration was cancelled or failed." : error.getMessage(), error);
                }
            }
        );
    }

    @PluginMethod
    public void get(PluginCall call) {
        String options = call.getString("options");
        if (options == null || options.trim().isEmpty()) {
            call.reject("Passkey authentication options are missing.");
            return;
        }
        GetPublicKeyCredentialOption publicKeyOption;
        try {
            publicKeyOption = new GetPublicKeyCredentialOption(options);
        } catch (Exception error) {
            call.reject("Invalid passkey authentication options.", error);
            return;
        }
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(publicKeyOption)
            .build();
        CancellationSignal cancellation = new CancellationSignal();
        call.setKeepAlive(true);
        credentialManager.getCredentialAsync(
            getActivity(), request, cancellation, mainExecutor,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    if (!(response.getCredential() instanceof PublicKeyCredential)) {
                        call.reject("Android did not return a passkey credential.");
                        return;
                    }
                    PublicKeyCredential credential = (PublicKeyCredential) response.getCredential();
                    JSObject result = new JSObject();
                    result.put("responseJson", credential.getAuthenticationResponseJson());
                    call.resolve(result);
                }
                @Override
                public void onError(GetCredentialException error) {
                    call.reject(error.getMessage() == null ? "Biometric/passkey verification was cancelled or failed." : error.getMessage(), error);
                }
            }
        );
    }
}
