package space.asteraonline.app.session;

import static org.junit.Assert.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.CookieHandler;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;

public class SessionHttpTest {
    private static final String ID = "36e43041-1e2c-45a4-9c3f-a42c974b64e5";
    private static final String SECRET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
    private static String session() { return "{\"accountId\":\"account\",\"username\":\"pilot\",\"displayName\":\"Pilot\",\"country\":\"TR\",\"accessToken\":\"short\",\"nativeSessionId\":\"" + ID + "\",\"refreshToken\":\"" + SECRET + "\",\"debugSecret\":\"hidden\"}"; }

    @Test public void stripsPrivateResponseFieldsBeforeCrossingBridge() throws Exception {
        SessionEngine.Reply reply = SessionHttp.decode("login", 200, session(), "1234", null);
        assertEquals(ID, reply.credential().id());
        assertEquals(SECRET, reply.credential().current());
        assertEquals("1234", reply.serverTime());
        JSONObject body = new JSONObject(reply.body());
        assertEquals("short", body.getString("accessToken"));
        assertFalse(body.has("nativeSessionId")); assertFalse(body.has("refreshToken")); assertFalse(body.has("debugSecret"));
    }

    @Test public void preservesClaimAndOnlyAllowsPublicErrorFields() throws Exception {
        JSONObject claim = new JSONObject(session()).put("placement", new JSONObject().put("shard", "S1"))
            .put("planet", new JSONObject().put("planet", new JSONObject().put("id", "home"))).put("applied", new org.json.JSONArray());
        JSONObject result = new JSONObject(SessionHttp.decode("claim", 200, claim.toString(), null, null).body());
        assertEquals("home", result.getJSONObject("planet").getJSONObject("planet").getString("id"));
        assertTrue(result.has("placement")); assertTrue(result.has("applied"));
        JSONObject error = new JSONObject(SessionHttp.decode("login", 401, "{\"error\":\"BAD_CREDENTIALS\",\"message\":\"Try again\",\"refreshToken\":\"secret\",\"headers\":{\"set-cookie\":\"secret\"}}", null, null).body());
        assertEquals(2, error.length());
    }

    @Test public void rejectsMalformedSessionsAndRefreshForAnotherSession() throws Exception {
        assertThrows(IOException.class, () -> SessionHttp.decode("login", 200, "{}", null, null));
        assertThrows(IOException.class, () -> SessionHttp.decode("login", 200, new JSONObject(session()).put("refreshToken", "short").toString(), null, null));
        assertThrows(IOException.class, () -> SessionHttp.decode("refresh", 200, session(), null, new SessionEngine.Credential("another-session", SECRET, SECRET)));
    }

    @Test public void requiresAnExplicitBooleanLogoutAcknowledgementBeforeDiscardingRevocations() throws Exception {
        for (String body : new String[]{"{}", "{\"ok\":false}", "{\"ok\":null}", "{\"ok\":\"true\"}", "{\"error\":\"UNAVAILABLE\"}", "not-json"}) {
            assertThrows("Unconfirmed logout must remain retryable: " + body, IOException.class,
                () -> SessionHttp.decode("logout", 200, body, null, null));
        }
        SessionEngine.Reply reply = SessionHttp.decode("logout", 200, "{\"ok\":true,\"refreshToken\":\"private\"}", "1234", null);
        assertEquals(200, reply.status());
        assertEquals("{\"ok\":true}", reply.body());
        assertNull(reply.credential());
    }

    @Test public void refusesInsecureRemoteOriginsAndReleaseLocalHttp() {
        for (String value : new String[]{"http://example.test", "https://user:secret@example.test", "https://example.test/api", "https://example.test?x=1", "https://localhost.evil.test/#secret"}) {
            assertThrows(IllegalArgumentException.class, () -> new SessionHttp(value, "native-production", true));
        }
        assertThrows(IllegalArgumentException.class, () -> new SessionHttp("http://localhost:3100", "native-local", false));
    }

    @Test public void sendsOnlyThePinnedOperationWithoutCookiesAndNeverFollowsRedirect() throws Exception {
        ServerSocket server = new ServerSocket(0);
        server.setSoTimeout(3000);
        AtomicReference<String> seen = new AtomicReference<>();
        AtomicReference<Throwable> error = new AtomicReference<>();
        Thread handler = new Thread(() -> {
            try {
                for (int i = 0; i < 2; i++) try (Socket socket = server.accept()) {
                    socket.setSoTimeout(3000);
                    BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                    String request = reader.readLine();
                    int length = 0; String line;
                    while ((line = reader.readLine()) != null && !line.isEmpty()) {
                        assertFalse(line.toLowerCase().startsWith("cookie:"));
                        if (line.toLowerCase().startsWith("content-length:")) length = Integer.parseInt(line.substring(line.indexOf(':') + 1).trim());
                    }
                    char[] input = new char[length]; int offset = 0;
                    while (offset < length) { int read = reader.read(input, offset, length - offset); if (read < 0) throw new IOException("short body"); offset += read; }
                    if (i == 0) {
                        assertTrue(request.contains("/api/native/auth/login")); seen.set(new String(input));
                        byte[] body = session().getBytes(StandardCharsets.UTF_8);
                        socket.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\nSet-Cookie: bs_refresh=private; HttpOnly\r\nContent-Length: " + body.length + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                        socket.getOutputStream().write(body);
                    } else {
                        assertTrue(request.contains("/api/native/auth/register"));
                        socket.getOutputStream().write("HTTP/1.1 307 Temporary Redirect\r\nLocation: /redirect-target\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.UTF_8));
                    }
                }
            } catch (Throwable failure) { error.set(failure); }
        });
        handler.setDaemon(true); handler.start();
        CookieHandler original = CookieHandler.getDefault();
        AtomicInteger cookieAccesses = new AtomicInteger();
        CookieHandler managedCookies = new CookieHandler() {
            @Override public Map<String, List<String>> get(URI uri, Map<String, List<String>> headers) {
                cookieAccesses.incrementAndGet();
                return Collections.singletonMap("Cookie", Collections.singletonList("bs_refresh=browser-secret"));
            }
            @Override public void put(URI uri, Map<String, List<String>> headers) { cookieAccesses.incrementAndGet(); }
        };
        CookieHandler.setDefault(managedCookies);
        try {
            SessionHttp http = new SessionHttp("http://localhost:" + server.getLocalPort(), "native-local", true);
            assertEquals(200, http.send("login", "{\"username\":\"pilot\",\"password\":\"private\"}", null).status());
            assertEquals("private", new JSONObject(seen.get()).getString("password"));
            assertThrows(IOException.class, () -> http.send("register", "{}", null));
            assertThrows(IllegalArgumentException.class, () -> http.send("https://evil.test", "{}", null));
            assertSame(managedCookies, CookieHandler.getDefault());
            assertEquals(0, cookieAccesses.get());
        } finally { CookieHandler.setDefault(original); server.close(); handler.join(3000); }
        assertNull(error.get());
    }
}
