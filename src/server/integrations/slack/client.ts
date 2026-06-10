const REQUEST_TIMEOUT_MS = 5000;

export type SlackMessagePayload = {
  text: string;
  blocks?: unknown[];
};

export type SendSlackMessageResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Slack Incoming Webhook으로 메시지를 전송합니다.
 * 실패 시 throw하지 않고 { ok: false, error } 를 반환합니다.
 */
export async function sendSlackMessage(
  webhookUrl: string,
  payload: SlackMessagePayload,
): Promise<SendSlackMessageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        error: `HTTP ${response.status}: ${body || 'no body'}`,
      };
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timer);
  }
}
