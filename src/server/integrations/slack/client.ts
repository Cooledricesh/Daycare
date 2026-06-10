const REQUEST_TIMEOUT_MS = 5000;

const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

export type SendSlackMessageResult =
  | { ok: true }
  | { ok: false; error: string };

interface ChatPostMessageResponse {
  ok: boolean;
  error?: string;
}

/**
 * Slack Bot Token(chat.postMessage)으로 지정 채널에 메시지를 전송합니다.
 * - 봇(@alimi)이 해당 채널에 초대되어 있어야 합니다 (`/invite @alimi`)
 * - Slack API는 실패 시에도 HTTP 200 + body.ok=false 를 반환하므로 body 기준으로 판정
 * - 실패 시 throw하지 않고 { ok: false, error } 를 반환합니다.
 */
export async function postSlackMessage(
  botToken: string,
  channel: string,
  text: string,
): Promise<SendSlackMessageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(SLACK_POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel, text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const body = (await response.json()) as ChatPostMessageResponse;
    if (!body.ok) {
      return { ok: false, error: body.error ?? 'unknown slack error' };
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
