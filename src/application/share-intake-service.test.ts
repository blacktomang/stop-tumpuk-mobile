import { describe, expect, it } from 'vitest';
import type { NativeRepositories } from '../storage/sqlite/repositories';
import type { CaptureIntake } from '../types';
import { createShareIntakeService } from './share-intake-service';

function repositories(staged: CaptureIntake[]): NativeRepositories {
  return {
    materials: {} as NativeRepositories['materials'],
    notes: {} as NativeRepositories['notes'],
    settings: {} as NativeRepositories['settings'],
    sessions: {} as NativeRepositories['sessions'],
    events: {} as NativeRepositories['events'],
    captureIntake: {
      get: async () => null,
      stage: async (intake) => {
        staged.push(intake);
      },
      consume: async () => undefined,
    },
    transaction: async (work) => work(repositories(staged)),
  };
}

describe('share intake service', () => {
  it('extracts and stages a URL from shared text with its title', async () => {
    const staged: CaptureIntake[] = [];
    const service = createShareIntakeService({
      repositories: repositories(staged),
      generateId: () => 'intake-1',
      now: () => '2026-11-12T00:00:00.000Z',
    });

    await expect(
      service.stage({
        text: 'Read this https://example.com/articles/one?utm_source=share',
        title: 'A shared article',
      }),
    ).resolves.toMatchObject({
      id: 'intake-1',
      url: 'https://example.com/articles/one?utm_source=share',
      title: 'A shared article',
      consumedAt: null,
    });
    expect(staged).toHaveLength(1);
  });

  it('prefers a direct URL and treats blank title as absent', async () => {
    const staged: CaptureIntake[] = [];
    const service = createShareIntakeService({
      repositories: repositories(staged),
      generateId: () => 'intake-2',
      now: () => '2026-11-12T00:00:00.000Z',
    });

    const intake = await service.stage({ url: 'https://example.com', text: 'not a URL', title: '  ' });
    expect(intake.url).toBe('https://example.com/');
    expect(intake.title).toBeNull();
  });

  it.each([
    {},
    { text: 'nothing link-like here' },
    { url: 'javascript:alert(1)' },
    { url: 42 },
  ])('rejects unsafe or missing payloads: %j', async (payload) => {
    const service = createShareIntakeService({
      repositories: repositories([]),
      generateId: () => 'unused',
      now: () => '2026-11-12T00:00:00.000Z',
    });
    await expect(service.stage(payload)).rejects.toThrow();
  });
});
