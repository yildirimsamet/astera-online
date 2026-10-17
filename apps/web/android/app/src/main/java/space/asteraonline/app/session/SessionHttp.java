package space.asteraonline.app.session;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONException;
import org.json.JSONObject;

/** Fixed origin and operations. No general HTTP, raw response headers, cookie jar or redirects. */
public final class SessionHttp implements SessionEngine.Network {
    private final String origin;
    private final OkHttpClient client = new OkHttpClient.Builder().cookieJar(CookieJar.NO_COOKIES)
        .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
        .connectTimeout(8, TimeUnit.SECONDS).readTimeout(8, TimeUnit.SECONDS).writeTimeout(8, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS).build();
    public SessionHttp(String origin, String target, boolean debug) {
        URI uri = URI.create(origin);
        boolean local = "native-local".equals(target);
        if ((!local && !"native-staging".equals(target) && !"native-production".equals(target))
            || uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
            || (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !uri.getRawPath().equals("/"))
            || (local ? !debug || !"http".equals(uri.getScheme()) || !"localhost".equals(uri.getHost())
                : !"https".equals(uri.getScheme()) || "localhost".equals(uri.getHost()) || uri.getHost().matches("[0-9.]+") || uri.getHost().contains(":"))) {
            throw new IllegalArgumentException("Invalid native API origin");
        }
        this.origin = origin.endsWith("/") ? origin.substring(0, origin.length() - 1) : origin;
    }

    @Override public SessionEngine.Reply send(String operation, String input, SessionEngine.Credential credential) throws IOException {
        String path = switch (operation) {
            case "login", "register", "refresh", "logout" -> "/api/native/auth/" + operation;
            case "claim" -> "/api/native/onboarding/claim";
            default -> throw new IllegalArgumentException("Unsupported session operation");
        };
        try {
            JSONObject body;
            if (operation.equals("refresh") || operation.equals("logout")) {
                if (credential == null) throw new IOException("Missing native session");
                body = new JSONObject().put("sessionId", credential.id()).put("refreshToken", credential.current());
                if (operation.equals("refresh")) body.put("nextRefreshToken", credential.next());
            } else {
                body = new JSONObject(input == null ? "{}" : input);
                if (body.has("sessionId") || body.has("nativeSessionId") || body.has("refreshToken") || body.has("nextRefreshToken")) {
                    throw new IOException("Invalid session input");
                }
            }
            byte[] encoded = body.toString().getBytes(StandardCharsets.UTF_8);
            if (encoded.length > 16_384) throw new IOException("Session request too large");
            Request request = new Request.Builder().url(origin + path).header("Accept", "application/json")
                .header("Cache-Control", "no-store").post(RequestBody.create(encoded, MediaType.get("application/json"))).build();
            try (Response result = client.newCall(request).execute()) {
                int status = result.code();
                if (status >= 300 && status < 400) throw new IOException("Session redirect refused");
                String response;
                try (InputStream stream = result.body().byteStream()) {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192]; int count;
                    long deadline = System.nanoTime() + 20_000_000_000L;
                    while ((count = stream.read(buffer)) != -1) {
                        if (bytes.size() + count > 2_097_152 || System.nanoTime() > deadline) throw new IOException("Session response limit");
                        bytes.write(buffer, 0, count);
                    }
                    response = new String(bytes.toByteArray(), StandardCharsets.UTF_8);
                }
                return decode(operation, status, response, result.header("x-server-time"), credential);
            }
        } catch (JSONException failure) { throw new IOException("Invalid session data"); }
    }

    static SessionEngine.Reply decode(String operation, int status, String raw, String serverTime, SessionEngine.Credential previous) throws IOException {
        try {
            JSONObject source;
            try { source = new JSONObject(raw); }
            catch (JSONException failure) {
                if (status < 400) throw failure;
                source = new JSONObject().put("error", "UNREACHABLE").put("message", "Service unavailable. Try again.");
            }
            JSONObject result = new JSONObject();
            if (status >= 400) {
                for (String key : new String[]{"error", "message", "params"}) if (source.has(key)) result.put(key, source.get(key));
                return new SessionEngine.Reply(status, result.toString(), serverTime, null);
            }
            if (status != 200) throw new IOException("Unexpected session response");
            if (operation.equals("logout")) {
                if (!Boolean.TRUE.equals(source.opt("ok"))) throw new IOException("Unconfirmed logout");
                return new SessionEngine.Reply(200, "{\"ok\":true}", serverTime, null);
            }
            for (String key : new String[]{"accountId", "username", "displayName", "accessToken"}) {
                if (!(source.opt(key) instanceof String) || source.getString(key).isEmpty()) throw new IOException("Invalid session response");
                result.put(key, source.get(key));
            }
            if (!source.has("country")) throw new IOException("Invalid session response");
            result.put("country", source.get("country"));
            if (source.has("loginEmail")) result.put("loginEmail", source.get("loginEmail"));
            String id = source.getString("nativeSessionId");
            if (!UUID.fromString(id).toString().equals(id)) throw new IOException("Invalid native session id");
            SessionEngine.Credential issued = null;
            if (operation.equals("refresh")) {
                if (previous == null || !id.equals(previous.id())) throw new IOException("Native session changed");
            } else {
                String secret = source.getString("refreshToken");
                if (!secret.matches("[A-Za-z0-9_-]{43}")) throw new IOException("Invalid native credential");
                issued = new SessionEngine.Credential(id, secret, null);
            }
            if (operation.equals("claim")) for (String key : new String[]{"placement", "planet", "applied"}) result.put(key, source.get(key));
            return new SessionEngine.Reply(status, result.toString(), serverTime, issued);
        } catch (JSONException | IllegalArgumentException failure) { throw new IOException("Invalid session response"); }
    }
}
