package space.asteraonline.app.session;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;
import org.junit.Test;

public class SessionVaultTest {
    @Test public void encryptsAcrossInstancesAndPreservesPendingRotationAndRevocationQueue() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SessionVault first = new SessionVault(context, "instrumentation-vault");
        first.destroy();
        try {
            SessionEngine.Credential credential = new SessionEngine.Credential("session", "private-current", "private-next");
            first.save(new SessionEngine.State(credential, Collections.singletonList(credential)));
            SessionEngine.State restored = new SessionVault(context, "instrumentation-vault").load();
            assertEquals(credential, restored.active()); assertEquals(credential, restored.revocations().get(0));
            String disk = new String(Files.readAllBytes(first.file().toPath()), StandardCharsets.ISO_8859_1);
            assertFalse(disk.contains("private-current")); assertFalse(disk.contains("private-next"));
            assertEquals(context.getNoBackupFilesDir(), first.file().getParentFile());
            first.save(new SessionEngine.State(null, Collections.emptyList()));
            assertNull(new SessionVault(context, "instrumentation-vault").load().active());
        } finally { first.destroy(); }
    }

    @Test public void rejectsTamperingAndCannotReuseAnotherEnvironmentCiphertext() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SessionVault first = new SessionVault(context, "instrumentation-vault-a");
        SessionVault other = new SessionVault(context, "instrumentation-vault-b");
        first.destroy(); other.destroy();
        try {
            first.save(new SessionEngine.State(new SessionEngine.Credential("session", "private", null), Collections.emptyList()));
            byte[] ciphertext = Files.readAllBytes(first.file().toPath());
            Files.write(other.file().toPath(), ciphertext);
            assertNull(other.load().active());
            ciphertext[ciphertext.length - 1] ^= 1;
            Files.write(first.file().toPath(), ciphertext);
            assertNull(first.load().active());
            assertFalse(first.file().exists());
        } finally { first.destroy(); other.destroy(); }
    }
}
