import { observe } from '../../lib/playerAnalytics/runtime.js';
import type { PrologueStage } from './world.js';

export const PROLOGUE_VERSION = 'prologue.v1';

/** Plan §6: the old training events, told apart by version, so one funnel reads both. */
export function prologueTelemetry(replay: boolean) {
  const mode = replay ? 'replay' : 'training';
  let attemptId: string | undefined;
  try { attemptId = crypto.randomUUID(); } catch { /* The events still count without one. */ }
  const send = (name: Parameters<typeof observe>[0], scene: PrologueStage, code?: string): void => {
    observe(name, { trainingVersion: PROLOGUE_VERSION, scene, ...(attemptId ? { attemptId } : {}), ...(code ? { code } : {}) }, mode);
  };
  return {
    started: (scene: PrologueStage, resumed: boolean) => { send(resumed ? 'training_resumed' : 'training_started', scene); },
    visible: (scene: PrologueStage) => { send('training_scene_visible', scene); },
    accepted: (scene: PrologueStage, action: string) => { send('training_action_accepted', scene, action); },
    skipped: (scene: PrologueStage) => { send('training_exit_requested', scene, 'skip'); },
    completed: (scene: PrologueStage) => { send('training_completed', scene); },
  };
}
