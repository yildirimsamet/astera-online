package space.asteraonline.app.session;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Keystore holds the AES key; only authenticated ciphertext is written, atomically, outside backup. */
public final class SessionVault implements SessionEngine.Store {
    private final AtomicFile storage;
    private final String alias;
    private final byte[] aad;

    public SessionVault(Context context, String scope) throws IOException {
        try {
            aad = (context.getPackageName() + "|" + scope).getBytes(StandardCharsets.UTF_8);
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(aad);
            StringBuilder suffix = new StringBuilder();
            for (byte value : hash) suffix.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            alias = "astera.session." + suffix;
            storage = new AtomicFile(new File(context.getNoBackupFilesDir(), alias + ".bin"));
        } catch (GeneralSecurityException failure) { throw new IOException("Secure storage unavailable"); }
    }

    @Override public synchronized SessionEngine.State load() throws IOException {
        if (!storage.getBaseFile().exists() && !new File(storage.getBaseFile() + ".bak").exists()) return empty();
        try {
            byte[] encoded = storage.readFully();
            if (encoded.length < 30 || encoded.length > 1_048_576 || encoded[0] != 1) throw new IOException("Invalid secure storage");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            SecretKey key = key(false);
            if (key == null) throw new GeneralSecurityException("Key missing");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Arrays.copyOfRange(encoded, 1, 13)));
            cipher.updateAAD(aad);
            JSONObject decoded = new JSONObject(new String(cipher.doFinal(Arrays.copyOfRange(encoded, 13, encoded.length)), StandardCharsets.UTF_8));
            SessionEngine.Credential active = decoded.isNull("active") ? null : credential(decoded.getJSONObject("active"));
            JSONArray queue = decoded.getJSONArray("revocations");
            List<SessionEngine.Credential> revocations = new ArrayList<>();
            for (int i = 0; i < queue.length(); i++) revocations.add(credential(queue.getJSONObject(i)));
            return new SessionEngine.State(active, revocations);
        } catch (GeneralSecurityException | JSONException | IOException failure) {
            // Missing/invalidated keys or corrupt ciphertext cannot become a plaintext fallback.
            destroy();
            return empty();
        }
    }

    @Override public synchronized void save(SessionEngine.State state) throws IOException {
        FileOutputStream stream = null;
        try {
            JSONArray queue = new JSONArray();
            for (SessionEngine.Credential credential : state.revocations()) queue.put(json(credential));
            JSONObject decoded = new JSONObject().put("active", state.active() == null ? JSONObject.NULL : json(state.active())).put("revocations", queue);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(true)); cipher.updateAAD(aad);
            byte[] encrypted = cipher.doFinal(decoded.toString().getBytes(StandardCharsets.UTF_8));
            if (cipher.getIV().length != 12) throw new IOException("Invalid encryption IV");
            stream = storage.startWrite();
            stream.write(1); stream.write(cipher.getIV()); stream.write(encrypted);
            stream.getFD().sync();
            storage.finishWrite(stream);
            byte[] committed = storage.readFully();
            byte[] expected = new byte[13 + encrypted.length];
            expected[0] = 1; System.arraycopy(cipher.getIV(), 0, expected, 1, 12);
            System.arraycopy(encrypted, 0, expected, 13, encrypted.length);
            if (!Arrays.equals(committed, expected)) throw new IOException("Secure storage commit failed");
        } catch (GeneralSecurityException | JSONException | IOException failure) {
            if (stream != null) storage.failWrite(stream);
            // A failed local logout must not resurrect the old file after a process restart.
            destroy();
            throw new IOException("Secure storage unavailable");
        }
    }

    synchronized void destroy() throws IOException {
        storage.delete();
        try {
            KeyStore keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null); keys.deleteEntry(alias);
        } catch (GeneralSecurityException failure) { throw new IOException("Secure storage unavailable"); }
    }
    File file() { return storage.getBaseFile(); }

    private SecretKey key(boolean create) throws GeneralSecurityException, IOException {
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        java.security.Key existing = keys.getKey(alias, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;
        if (!create) return null;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
    private static JSONObject json(SessionEngine.Credential value) throws JSONException {
        return new JSONObject().put("id", value.id()).put("current", value.current()).put("next", value.next() == null ? JSONObject.NULL : value.next());
    }
    private static SessionEngine.Credential credential(JSONObject value) throws JSONException {
        return new SessionEngine.Credential(value.getString("id"), value.getString("current"), value.isNull("next") ? null : value.getString("next"));
    }
    private static SessionEngine.State empty() { return new SessionEngine.State(null, Collections.emptyList()); }
}
