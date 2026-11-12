import type { NativeRepositories } from '../storage/sqlite/repositories';
import type { LearningSession } from '../types';

export const focusDurationSeconds = 25 * 60;

export interface TimerDependencies {
  repositories: NativeRepositories;
  generateId: () => string;
  now: () => string;
}

function elapsedAt(session: LearningSession, now: string): number {
  if (session.state !== 'running') return session.elapsedSeconds;
  const delta = Math.floor((Date.parse(now) - Date.parse(session.stateChangedAt)) / 1000);
  return session.elapsedSeconds + Math.max(0, delta);
}

export function elapsedSecondsAt(session: LearningSession, now: string): number {
  return elapsedAt(session, now);
}

export function remainingSecondsAt(session: LearningSession, now: string): number {
  return Math.max(0, focusDurationSeconds - elapsedAt(session, now));
}

export function isExpiredAt(session: LearningSession, now: string): boolean {
  return remainingSecondsAt(session, now) === 0;
}

export function createTimerService(dependencies: TimerDependencies) {
  async function start(materialId: string): Promise<LearningSession> {
    const active = await dependencies.repositories.sessions.getActiveForMaterial(materialId);
    if (active) throw new Error('An active focus timer already exists for this material.');
    const timestamp = dependencies.now();
    const session: LearningSession = {
      id: dependencies.generateId(),
      materialId,
      startedAt: timestamp,
      elapsedSeconds: 0,
      state: 'running',
      stateChangedAt: timestamp,
      endedAt: null,
    };
    await dependencies.repositories.transaction(async (repositories) => {
      await repositories.sessions.insert(session);
    });
    return session;
  }

  async function pause(session: LearningSession): Promise<void> {
    if (session.state !== 'running') {
      throw new Error('Only a running focus timer can be paused.');
    }
    const timestamp = dependencies.now();
    await dependencies.repositories.transaction(async (repositories) => {
      await repositories.sessions.update(session.id, {
        elapsedSeconds: elapsedAt(session, timestamp),
        state: 'paused',
        stateChangedAt: timestamp,
      });
    });
  }

  async function resume(session: LearningSession): Promise<void> {
    if (session.state !== 'paused') {
      throw new Error('Only a paused focus timer can be resumed.');
    }
    const timestamp = dependencies.now();
    await dependencies.repositories.transaction(async (repositories) => {
      await repositories.sessions.update(session.id, {
        state: 'running',
        stateChangedAt: timestamp,
      });
    });
  }

  async function end(session: LearningSession): Promise<void> {
    const timestamp = dependencies.now();
    await dependencies.repositories.transaction(async (repositories) => {
      await repositories.sessions.update(session.id, {
        elapsedSeconds: elapsedAt(session, timestamp),
        state: 'ended',
        stateChangedAt: timestamp,
        endedAt: timestamp,
      });
    });
  }

  return { start, pause, resume, end };
}
