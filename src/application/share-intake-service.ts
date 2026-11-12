import { classifyUrl, extractSharedUrl } from '../domain';
import type { NativeRepositories } from '../storage/sqlite/repositories';
import type { CaptureIntake } from '../types';

export interface SharedPayload {
  /** URL supplied directly by the platform share API, when available. */
  url?: unknown;
  /** Shared text or a URL copied from the platform share API. */
  text?: unknown;
  /** Optional subject/title supplied by the platform share API. */
  title?: unknown;
}

export interface ShareIntakeDependencies {
  repositories: NativeRepositories;
  generateId: () => string;
  now: () => string;
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be text when provided.`);
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Convert an OS share payload into the staged intake consumed by the normal
 * destination-aware capture form. Platform listeners should pass raw values;
 * this boundary validates them before they reach persistence.
 */
export function createShareIntakeService(dependencies: ShareIntakeDependencies) {
  async function stage(payload: SharedPayload): Promise<CaptureIntake> {
    if (payload === null || typeof payload !== 'object') {
      throw new Error('A shared URL or text payload is required.');
    }

    const directUrl = optionalText(payload.url, 'Shared URL');
    const text = optionalText(payload.text, 'Shared text');
    const candidate = directUrl ?? (text ? extractSharedUrl(text) : null);
    if (!candidate) throw new Error('The shared payload does not contain an HTTP(S) URL.');

    const { url } = classifyUrl(candidate);
    const title = optionalText(payload.title, 'Shared title');
    const intake: CaptureIntake = {
      id: dependencies.generateId(),
      url: url.toString(),
      title,
      receivedAt: dependencies.now(),
      consumedAt: null,
    };

    await dependencies.repositories.transaction(async (repositories) => {
      await repositories.captureIntake.stage(intake);
    });
    return intake;
  }

  return { stage };
}
