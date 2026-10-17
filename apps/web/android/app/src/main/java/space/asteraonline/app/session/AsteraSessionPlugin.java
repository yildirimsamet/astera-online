package space.asteraonline.app.session;

import android.content.pm.ApplicationInfo;
import android.util.Base64;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;

@CapacitorPlugin(name = "AsteraSession")
public final class AsteraSessionPlugin extends Plugin {
    private static final ExecutorService NETWORK = Executors.newSingleThreadExecutor();
    private static final Map<String, SessionEngine> ENGINES = new HashMap<>();
    private static final SecureRandom RANDOM = new SecureRandom();
    private boolean enabled;
    private boolean safeBridge;

    @Override public void load() {
        String target = getConfig().getString("target", "");
        enabled = target.equals("native-local") || target.equals("native-staging") || target.equals("native-production");
        if (!enabled) return;
        // Bridge registers plugins synchronously after MessageHandler, BEFORE the first page load.
        // Remove its legacy fallback: only the origin-restricted, main-frame WebMessageListener survives.
        bridge.getWebView().removeJavascriptInterface("androidBridge");
        safeBridge = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
            && !bridge.getConfig().isUsingLegacyBridge() && bridge.getServerUrl() == null
            && bridge.getConfig().getAllowNavigation().length == 0;
    }

    @PluginMethod public void request(PluginCall call) {
        if (!enabled || !safeBridge) { unavailable(call); return; }
        String operation = call.getString("operation", "");
        try {
            SessionEngine engine = engine();
            // The fence must happen now, not behind an older network request on the executor.
            SessionEngine.Ticket ticket = engine.begin(operation);
            if (operation.equals("logout")) {
                reply(call, new SessionEngine.Reply(200, "{\"ok\":true}", null, null));
                retry(engine); return;
            }
            JSObject body = call.getObject("body");
            NETWORK.execute(() -> {
                try { reply(call, engine.execute(ticket, body == null ? null : body.toString())); }
                catch (IOException failure) { unavailable(call); }
                retry(engine);
            });
        } catch (IOException | IllegalArgumentException failure) { unavailable(call); }
    }

    @PluginMethod public void clear(PluginCall call) {
        if (!enabled || !safeBridge) { call.reject("Secure session storage unavailable"); return; }
        try {
            SessionEngine engine = engine(); engine.begin("clear");
            call.resolve(); retry(engine);
        } catch (IOException | IllegalArgumentException failure) { call.reject("Secure session storage unavailable"); }
    }

    @Override protected void handleOnResume() {
        if (enabled && safeBridge) NETWORK.execute(() -> {
            try { engine().retryRevocations(); } catch (IOException | IllegalArgumentException failure) { /* Retry next request; never log credentials. */ }
        });
    }

    private SessionEngine engine() throws IOException {
        String apiUrl = getConfig().getString("apiUrl", "");
        String target = getConfig().getString("target", "");
        String scope = target + "|" + apiUrl;
        synchronized (ENGINES) {
            SessionEngine existing = ENGINES.get(scope);
            if (existing != null) return existing;
            boolean debug = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            SessionEngine created = new SessionEngine(new SessionVault(getContext(), scope), new SessionHttp(apiUrl, target, debug), () -> {
                byte[] secret = new byte[32]; RANDOM.nextBytes(secret);
                return Base64.encodeToString(secret, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
            });
            ENGINES.put(scope, created); return created;
        }
    }
    private static void retry(SessionEngine engine) {
        NETWORK.execute(() -> { try { engine.retryRevocations(); } catch (IOException failure) { /* Fail closed until a healthy store can be opened. */ } });
    }
    private static void reply(PluginCall call, SessionEngine.Reply reply) {
        try {
            JSObject result = new JSObject(); result.put("status", reply.status()); result.put("body", new JSObject(reply.body()));
            if (reply.serverTime() != null) result.put("serverTime", reply.serverTime());
            call.resolve(result);
        } catch (JSONException failure) { unavailable(call); }
    }
    private static void unavailable(PluginCall call) {
        try { reply(call, new SessionEngine.Reply(503, "{\"error\":\"UNREACHABLE\",\"message\":\"Sign-in is unavailable. Check your connection and try again.\"}", null, null)); }
        catch (RuntimeException failure) { call.reject("Sign-in unavailable"); }
    }
}
