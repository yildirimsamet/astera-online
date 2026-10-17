package space.asteraonline.app.session;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;

/** No Android/HTTP dependencies: the durable rotation and logout race protocol. */
public final class SessionEngine {
    public record Credential(String id, String current, String next) {}
    public record State(Credential active, List<Credential> revocations) {
        public State { revocations = Collections.unmodifiableList(new ArrayList<>(revocations)); }
    }
    public record Reply(int status, String body, String serverTime, Credential credential) {
        public Reply publicReply() { return new Reply(status, body, serverTime, null); }
    }
    public record Ticket(String operation, long generation) {}
    public interface Store {
        State load() throws IOException;
        void save(State value) throws IOException;
    }
    public interface Network {
        Reply send(String operation, String body, Credential credential) throws IOException;
    }

    private final Store store;
    private final Network network;
    private final Supplier<String> random;
    private State state;
    private long generation;
    private boolean healthy = true;

    public SessionEngine(Store store, Network network, Supplier<String> random) throws IOException {
        this.store = store; this.network = network; this.random = random;
        state = store.load();
    }

    /** Called at bridge invocation, before queued HTTP: logout fences in-flight work immediately. */
    public synchronized Ticket begin(String operation) throws IOException {
        if (!operation.equals("login") && !operation.equals("register") && !operation.equals("claim")
            && !operation.equals("refresh") && !operation.equals("logout") && !operation.equals("clear")) {
            throw new IllegalArgumentException("Unsupported session operation");
        }
        if (!healthy) throw new IOException("Secure storage unavailable");
        if (!operation.equals("refresh")) {
            generation++;
            List<Credential> queue = new ArrayList<>(state.revocations());
            if (state.active() != null) queue.add(state.active());
            persist(new State(null, queue));
        }
        return new Ticket(operation, generation);
    }

    /** The plugin serializes executions; begin() remains free while network is in flight. */
    public Reply execute(Ticket ticket, String body) throws IOException {
        if (ticket.operation().equals("logout") || ticket.operation().equals("clear")) {
            retryRevocations();
            return new Reply(200, "{\"ok\":true}", null, null);
        }
        Credential credential = null;
        synchronized (this) {
            if (!healthy) throw new IOException("Secure storage unavailable");
            if (ticket.generation() != generation) return changed();
            if (ticket.operation().equals("refresh")) {
                credential = state.active();
                if (credential == null) return new Reply(401, "{\"error\":\"BAD_SESSION\",\"message\":\"Sign in again\"}", null, null);
                if (credential.next() == null) {
                    credential = new Credential(credential.id(), credential.current(), random.get());
                    persist(new State(credential, state.revocations()));
                }
            }
        }
        Reply response = network.send(ticket.operation(), body, credential);
        synchronized (this) {
            if (ticket.generation() != generation) {
                if (response.credential() != null) enqueue(response.credential());
                return changed();
            }
            if (ticket.operation().equals("refresh")) {
                if (response.status() == 200 && credential != null) {
                    persist(new State(new Credential(credential.id(), credential.next(), null), state.revocations()));
                } else if (response.status() == 401) {
                    persist(new State(null, state.revocations()));
                }
            } else if (response.status() == 200) {
                if (response.credential() == null) throw new IOException("Invalid session response");
                persist(new State(response.credential(), state.revocations()));
            }
        }
        return response.publicReply();
    }

    /** Best effort; pending revocations survive offline/logout/process death in the encrypted store. */
    public void retryRevocations() throws IOException {
        // Bound one pass; another app start/resume/request retries the remaining entries.
        for (int i = 0; i < 3; i++) {
            Credential credential;
            synchronized (this) {
                if (!healthy || state.revocations().isEmpty()) return;
                credential = state.revocations().get(0);
            }
            Reply reply;
            try { reply = network.send("logout", null, credential); }
            catch (IOException offline) { return; }
            if (reply.status() != 200) return;
            synchronized (this) {
                List<Credential> queue = new ArrayList<>(state.revocations());
                queue.remove(credential);
                persist(new State(state.active(), queue));
            }
        }
    }

    private void enqueue(Credential credential) throws IOException {
        List<Credential> queue = new ArrayList<>(state.revocations());
        queue.add(credential);
        persist(new State(state.active(), queue));
    }

    private void persist(State next) throws IOException {
        try { store.save(next); state = next; }
        catch (IOException failure) {
            healthy = false;
            state = new State(null, Collections.emptyList());
            throw failure;
        }
    }

    private static Reply changed() {
        return new Reply(409, "{\"error\":\"SESSION_CHANGED\",\"message\":\"Session changed\"}", null, null);
    }
}
