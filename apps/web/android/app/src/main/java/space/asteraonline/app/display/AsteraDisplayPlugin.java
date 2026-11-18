package space.asteraonline.app.display;

import android.webkit.WebSettings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * THE INTERFACE SIZE'S SHELL HALF (owner 2026-11-17). The page scales itself as one piece by
 * narrowing its layout viewport (`src/lib/uiScale.ts`); this plugin lets the WebView do that
 * and tells the page the phone's font size, its starting point.
 */
@CapacitorPlugin(name = "AsteraDisplay")
public final class AsteraDisplayPlugin extends Plugin {
    @Override public void load() {
        WebSettings settings = bridge.getWebView().getSettings();
        // The WebView's own text zoom follows the phone's font size and grows the TEXT alone,
        // parting it from its icons and rows; the page takes that size as a whole instead.
        settings.setTextZoom(100);
        // Without it the WebView ignores the viewport line's width and a scaled page is cropped.
        // Every page it opens names its own viewport, so nothing falls back to a 980 px layout.
        settings.setUseWideViewPort(true);
    }

    @PluginMethod public void fontScale(PluginCall call) {
        JSObject result = new JSObject();
        result.put("value", (double) getContext().getResources().getConfiguration().fontScale);
        call.resolve(result);
    }
}
