package space.asteraonline.app.session;

import static org.junit.Assert.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public class SessionEngineTest {
    private static final SessionEngine.Credential INITIAL = new SessionEngine.Credential("session-one", "current-secret", null);
    private static final class MemoryStore implements SessionEngine.Store {
        SessionEngine.State state = new SessionEngine.State(null, Collections.emptyList());
        boolean fail;
        public SessionEngine.State load() { return state; }
        public void save(SessionEngine.State value) throws IOException {
            if (fail) throw new IOException("disk unavailable");
            state = value;
        }
    }
    private static SessionEngine.Reply issued() { return new SessionEngine.Reply(200, "{\"accessToken\":\"short\"}", null, INITIAL); }
    private static SessionEngine.Reply refreshed() { return new SessionEngine.Reply(200, "{\"accessToken\":\"short\"}", null, null); }
    private static SessionEngine.Reply ok() { return new SessionEngine.Reply(200, "{\"ok\":true}", null, null); }
    private static void login(SessionEngine engine) throws Exception { assertEquals(200, engine.execute(engine.begin("login"), "{}").status()); }

    @Test public void persistsBeforeExposingAccessAndDoesNotExposeCredential() throws Exception {
        MemoryStore store = new MemoryStore();
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> issued(), () -> "next-secret");
        SessionEngine.Reply reply = engine.execute(engine.begin("login"), "{}");
        assertEquals(INITIAL, store.state.active());
        assertNull(reply.credential());
        assertFalse(reply.body().contains("current-secret"));
    }

    @Test public void doesNotExposeAccessWhenPersistFails() throws Exception {
        MemoryStore store = new MemoryStore();
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> issued(), () -> "next-secret");
        SessionEngine.Ticket ticket = engine.begin("login");
        store.fail = true;
        assertThrows(IOException.class, () -> engine.execute(ticket, "{}"));
        assertNull(store.state.active());
    }

    @Test public void persistsNextBeforeNetworkAndRetriesSamePairAfterLostResponseAndRestart() throws Exception {
        MemoryStore store = new MemoryStore();
        store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        List<SessionEngine.Credential> sent = new ArrayList<>();
        SessionEngine.Network lost = (op, body, credential) -> {
            assertEquals(credential, store.state.active());
            assertEquals("next-secret", credential.next());
            sent.add(credential);
            throw new IOException("response lost");
        };
        SessionEngine engine = new SessionEngine(store, lost, () -> "next-secret");
        assertThrows(IOException.class, () -> engine.execute(engine.begin("refresh"), null));
        SessionEngine restarted = new SessionEngine(store, (op, body, credential) -> {
            sent.add(credential); return refreshed();
        }, () -> "different-next");
        assertEquals(200, restarted.execute(restarted.begin("refresh"), null).status());
        assertEquals(sent.get(0), sent.get(1));
        assertEquals("next-secret", store.state.active().current());
        assertNull(store.state.active().next());
    }

    @Test public void cannotSendRefreshUnlessPendingPairWasPersisted() throws Exception {
        MemoryStore store = new MemoryStore(); store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> { fail("network must not run"); return ok(); }, () -> "next");
        store.fail = true;
        assertThrows(IOException.class, () -> engine.execute(engine.begin("refresh"), null));
        assertNull(store.state.active().next());
    }

    @Test public void keepsPairOnServerOutageButClearsOn401() throws Exception {
        MemoryStore store = new MemoryStore(); store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> new SessionEngine.Reply(503, "{}", null, null), () -> "next");
        assertEquals(503, engine.execute(engine.begin("refresh"), null).status());
        assertEquals("next", store.state.active().next());
        SessionEngine rejected = new SessionEngine(store, (op, body, credential) -> new SessionEngine.Reply(401, "{}", null, null), () -> "unused");
        assertEquals(401, rejected.execute(rejected.begin("refresh"), null).status());
        assertNull(store.state.active());
    }

    @Test public void signsOutLocallyBeforeNetworkAndRetriesRevocationAfterRestart() throws Exception {
        MemoryStore store = new MemoryStore(); store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> { throw new IOException("offline"); }, () -> "next");
        SessionEngine.Ticket ticket = engine.begin("logout");
        assertNull(store.state.active());
        assertEquals(1, store.state.revocations().size());
        assertEquals(200, engine.execute(ticket, null).status());
        assertEquals(1, store.state.revocations().size());
        SessionEngine restarted = new SessionEngine(store, (op, body, credential) -> {
            assertEquals("logout", op); assertEquals(INITIAL, credential); return ok();
        }, () -> "next");
        restarted.retryRevocations();
        assertTrue(store.state.revocations().isEmpty());
    }

    @Test public void logoutFencesAnInflightRefresh() throws Exception {
        MemoryStore store = new MemoryStore(); store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        CountDownLatch sent = new CountDownLatch(1), release = new CountDownLatch(1);
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> {
            sent.countDown();
            try { if (!release.await(3, TimeUnit.SECONDS)) throw new IOException("timeout"); }
            catch (InterruptedException e) { throw new IOException(e); }
            return refreshed();
        }, () -> "next");
        SessionEngine.Ticket ticket = engine.begin("refresh");
        AtomicReference<SessionEngine.Reply> response = new AtomicReference<>();
        AtomicReference<Exception> error = new AtomicReference<>();
        Thread thread = new Thread(() -> { try { response.set(engine.execute(ticket, null)); } catch (Exception e) { error.set(e); } });
        thread.start();
        assertTrue(sent.await(3, TimeUnit.SECONDS));
        engine.begin("logout");
        release.countDown(); thread.join(3000);
        assertNull(error.get());
        assertEquals(409, response.get().status());
        assertNull(store.state.active());
    }

    @Test public void queuesALateLoginRatherThanResurrectingSignedOutIdentity() throws Exception {
        MemoryStore store = new MemoryStore();
        AtomicReference<SessionEngine> ref = new AtomicReference<>();
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> {
            ref.get().begin("logout"); return issued();
        }, () -> "next");
        ref.set(engine);
        assertEquals(409, engine.execute(engine.begin("login"), "{}").status());
        assertNull(store.state.active());
        assertEquals(INITIAL, store.state.revocations().get(0));
    }

    @Test public void rejectsUnknownOperationsBeforeNetworkOrCredentialChanges() throws Exception {
        MemoryStore store = new MemoryStore(); store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> { fail("network"); return ok(); }, () -> "next");
        assertThrows(IllegalArgumentException.class, () -> engine.begin("https://evil.test"));
        assertEquals(INITIAL, store.state.active());
    }

    @Test public void neverStartsAuthenticationThatOutlivedTheSafeQueueBudget() throws Exception {
        for (String operation : new String[]{"login", "register", "claim"}) {
            MemoryStore store = new MemoryStore();
            java.util.concurrent.atomic.AtomicLong time = new java.util.concurrent.atomic.AtomicLong(-1_000_000);
            SessionEngine engine = new SessionEngine(store, (op, body, credential) -> { fail("expired request must not reach HTTP"); return issued(); }, () -> "next", time::get);
            SessionEngine.Ticket ticket = engine.begin(operation);
            time.addAndGet(20_000_000_000L);
            assertEquals(503, engine.execute(ticket, "{}").status());
            assertNull(store.state.active());
        }
    }

    @Test public void expiredQueuedRefreshPreservesTheDurablePendingPair() throws Exception {
        MemoryStore store = new MemoryStore();
        SessionEngine.Credential pending = new SessionEngine.Credential(INITIAL.id(), INITIAL.current(), "persisted-next");
        store.state = new SessionEngine.State(pending, Collections.emptyList());
        java.util.concurrent.atomic.AtomicLong time = new java.util.concurrent.atomic.AtomicLong();
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> { fail("expired refresh must not reach HTTP"); return refreshed(); }, () -> "unused", time::get);
        SessionEngine.Ticket ticket = engine.begin("refresh");
        time.set(60_000_000_000L);
        assertEquals(503, engine.execute(ticket, null).status());
        assertEquals(pending, store.state.active());
    }

    @Test public void freshRefreshAtTheQueueBoundaryStillWorksAndLogoutWins() throws Exception {
        MemoryStore store = new MemoryStore();
        store.state = new SessionEngine.State(INITIAL, Collections.emptyList());
        java.util.concurrent.atomic.AtomicLong time = new java.util.concurrent.atomic.AtomicLong();
        SessionEngine engine = new SessionEngine(store, (op, body, credential) -> refreshed(), () -> "next", time::get);
        SessionEngine.Ticket ticket = engine.begin("refresh");
        time.set(19_999_999_999L);
        assertEquals(200, engine.execute(ticket, null).status());
        assertEquals("next", store.state.active().current());
        SessionEngine.Ticket stale = engine.begin("refresh");
        engine.begin("logout");
        time.addAndGet(60_000_000_000L);
        assertEquals(409, engine.execute(stale, null).status());
        assertNull(store.state.active());
    }
}
