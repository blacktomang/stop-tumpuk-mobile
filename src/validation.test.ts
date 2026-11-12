import { describe, expect, it } from 'vitest';
import { isCaptureIntake, isLearningSession, isMaterial, isNote, isSettings } from './validation';
import type { Material } from './types';

const material: Material = {
  id: 'material-1',
  originalUrl: 'https://example.com/article',
  normalizedUrl: 'https://example.com/article',
  domain: 'example.com',
  title: 'Article',
  thumbnailUrl: null,
  type: 'article',
  status: 'queued',
  sourceDurationSeconds: 600,
  sourceDurationProvenance: 'publisher-estimate',
  sourceDurationCompleteness: 'full',
  playbackSpeed: 1,
  manualEstimatedSeconds: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('native runtime record validation', () => {
  it('accepts a valid material and preserves explicit zero estimates', () => {
    expect(isMaterial({ ...material, manualEstimatedSeconds: 0 })).toBe(true);
  });

  it('rejects invalid URLs and negative durations', () => {
    expect(isMaterial({ ...material, originalUrl: 'file:///private/data' })).toBe(false);
    expect(isMaterial({ ...material, sourceDurationSeconds: -1 })).toBe(false);
  });

  it('distinguishes valid unset settings from invalid numeric values', () => {
    expect(
      isSettings({
        id: 'settings',
        weekdayMinutes: null,
        weekendMinutes: 0,
        onboardingDismissed: true,
        availabilityReminderAt: null,
      }),
    ).toBe(true);
    expect(
      isSettings({
        id: 'settings',
        weekdayMinutes: Number.NaN,
        weekendMinutes: 0,
        onboardingDismissed: true,
        availabilityReminderAt: null,
      }),
    ).toBe(false);
  });

  it('validates note, session, and staged-share records at the boundary', () => {
    expect(
      isNote({
        id: 'note-1',
        materialId: material.id,
        content: 'A useful note',
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
      }),
    ).toBe(true);
    expect(
      isLearningSession({
        id: 'session-1',
        materialId: material.id,
        startedAt: material.createdAt,
        elapsedSeconds: 0,
        state: 'paused',
        stateChangedAt: material.updatedAt,
        endedAt: null,
      }),
    ).toBe(true);
    expect(
      isCaptureIntake({
        id: 'intake-1',
        url: material.originalUrl,
        title: null,
        receivedAt: material.createdAt,
        consumedAt: null,
      }),
    ).toBe(true);
  });
});
