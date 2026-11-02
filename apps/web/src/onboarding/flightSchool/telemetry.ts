import type { AnalyticsName, AnalyticsProperties } from '../../api/analyticsSchemas.js';
import type { SchoolSceneId } from './scenes.js';
import { SCHOOL_SCENES } from './scenes.js';
import { ANALYTICS_TRAINING_STORAGE_KEY } from '../../lib/playerAnalytics/preference.js';

const KEY = ANALYTICS_TRAINING_STORAGE_KEY;
type Emit = (name: AnalyticsName, properties: AnalyticsProperties, mode: 'training' | 'replay') => void;
/** Observes the current presentation only. Restoring the game ledger never replays telemetry. */
export class SchoolTelemetry {
  private attemptId: string | null = null;
  private scene: SchoolSceneId | null = null;
  private phase = '';
  private revealedPhases = new Set<string>();
  private readyScenes = new Set<string>();
  private ended = false;
  private foreground = false;
  constructor(private startedAt: number, private replay: boolean, private resumed: boolean,
    private enabled: () => boolean, private emit: Emit) {}
  private properties(extra: AnalyticsProperties = {}): AnalyticsProperties {
    return { attemptId: this.attemptId ?? undefined, trainingVersion: 'flight-school.v1',
      step: SCHOOL_SCENES.find(scene => scene.id === extra.scene)?.chapter, ...extra };
  }
  private send(name: AnalyticsName, properties: AnalyticsProperties): void {
    if (this.enabled() && this.attemptId && this.foreground) this.emit(name, this.properties(properties), this.replay ? 'replay' : 'training');
  }
  visible(scene: SchoolSceneId, phase: string, foreground: boolean, prepared: boolean): void {
    this.foreground = foreground;
    if (!this.enabled() || !foreground || !prepared) return;
    if (!this.attemptId) {
      try { this.attemptId ??= crypto.randomUUID(); } catch { return; }
      this.send(this.resumed ? 'training_resumed' : 'training_started', { scene });
    }
    if (this.scene !== scene) {
      if (this.scene) this.send('training_scene_completed', { scene: this.scene });
      this.send('training_scene_visible', { scene, phase });
      if (scene.endsWith('Result') || scene.endsWith('Report')) this.send('training_result_visible', { scene });
      this.scene = scene;
    }
    this.phase = phase;
  }
  revealed(scene: SchoolSceneId, phase: string): void {
    const key = `${scene}:${phase}`;
    if (!this.revealedPhases.has(key) && this.enabled() && this.attemptId && this.foreground) {
      this.revealedPhases.add(key); this.send('training_text_revealed', { scene, phase });
    }
  }
  revoke(): void {
    this.attemptId = null; this.scene = null; this.ended = false; this.revealedPhases.clear(); this.readyScenes.clear();
    if (!this.replay) { try { localStorage.removeItem(KEY); } catch { /* Optional storage. */ } }
  }
  ready(scene: SchoolSceneId): void {
    if (!this.readyScenes.has(scene) && this.enabled() && this.attemptId) {
      this.readyScenes.add(scene); this.send('training_action_ready', { scene, phase: this.phase });
    }
  }
  accepted(scene: SchoolSceneId, action: string): void { this.send('training_action_accepted', { scene, code: action }); }
  exit(scene: SchoolSceneId): void {
    if (this.ended || !this.enabled() || !this.attemptId) return;
    this.ended = true;
    this.send(scene === 'departure' ? 'training_completed' : 'training_exit_requested', { scene, code: scene === 'departure' ? 'completed' : 'skipped' });
  }
}
