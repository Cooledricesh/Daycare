import { getAppConfig } from '@/server/config';
import {
  CareschedulerInjectionsResponseSchema,
  type CareschedulerInjectionsResponse,
} from './schema';

const REQUEST_TIMEOUT_MS = 5000;
const INJECTIONS_PATH = '/api/external/injections';
const API_KEY_HEADER = 'x-daycare-api-key';

export type FetchInjectionsResult =
  | { ok: true; data: CareschedulerInjectionsResponse }
  | { ok: false; reason: 'unauthorized' | 'timeout' | 'network' | 'bad_response'; detail?: string };

export async function fetchInjectionsByPatientNumber(
  patientNumber: string,
): Promise<FetchInjectionsResult> {
  const { carescheduler } = getAppConfig();

  const url = new URL(INJECTIONS_PATH, carescheduler.apiUrl);
  url.searchParams.set('patient_number', patientNumber);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        [API_KEY_HEADER]: carescheduler.apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.status === 401) {
      return { ok: false, reason: 'unauthorized' };
    }

    if (!response.ok) {
      return {
        ok: false,
        reason: 'bad_response',
        detail: `HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as unknown;
    const parsed = CareschedulerInjectionsResponseSchema.safeParse(body);

    if (!parsed.success) {
      return {
        ok: false,
        reason: 'bad_response',
        detail: parsed.error.issues.map((i) => i.message).join('; '),
      };
    }

    return { ok: true, data: parsed.data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return {
      ok: false,
      reason: 'network',
      detail: err instanceof Error ? err.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timer);
  }
}
