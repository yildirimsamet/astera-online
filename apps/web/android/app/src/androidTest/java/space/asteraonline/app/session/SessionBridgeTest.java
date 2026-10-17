package space.asteraonline.app.session;

import static org.junit.Assert.*;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import space.asteraonline.app.debug.MainActivity;

/** This test replaces only the local test app's document; no backend identity mutation. */
public class SessionBridgeTest {
    public static final class Probe {
        final CountDownLatch done = new CountDownLatch(1);
        final AtomicReference<String> child = new AtomicReference<>();
        final AtomicReference<String> main = new AtomicReference<>();
        @JavascriptInterface public void frame(String value) { child.set(value); done.countDown(); }
        @JavascriptInterface public void top(String value) { main.set(value); }
    }
    @Test public void keepsModernBridgeOnMainDocumentWithoutLegacyAccessFromOpaqueIframe() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Probe probe = new Probe();
            scenario.onActivity(activity -> {
                assertNull(activity.getBridge().getServerUrl());
                WebView view = activity.getBridge().getWebView();
                view.addJavascriptInterface(probe, "AsteraFrameTestProbe");
                String html = "<!doctype html><html><body><script>"
                    + "AsteraFrameTestProbe.top(typeof window.androidBridge);"
                    + "window.addEventListener('message',e=>{if(e.data && e.data.asteraFrameProbe) AsteraFrameTestProbe.frame(e.data.bridge);});"
                    + "</script><iframe sandbox=\"allow-scripts\" srcdoc=\"<script>parent.postMessage({asteraFrameProbe:true,bridge:typeof window.androidBridge},'*')</script>\"></iframe></body></html>";
                view.loadDataWithBaseURL(activity.getBridge().getLocalUrl(), html, "text/html", "UTF-8", null);
            });
            assertTrue("Frame did not load", probe.done.await(15, TimeUnit.SECONDS));
            assertEquals("object", probe.main.get());
            assertEquals("undefined", probe.child.get());
            scenario.onActivity(activity -> activity.getBridge().getWebView().removeJavascriptInterface("AsteraFrameTestProbe"));
        }
    }
}
