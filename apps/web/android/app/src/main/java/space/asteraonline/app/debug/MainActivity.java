package space.asteraonline.app.debug;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import space.asteraonline.app.session.AsteraSessionPlugin;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AsteraSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
