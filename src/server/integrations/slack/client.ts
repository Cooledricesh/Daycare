const REQUEST_TIMEOUT_MS = 5000;
const HISTORY_REQUEST_TIMEOUT_MS = 10000;

const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';
const SLACK_CONVERSATIONS_HISTORY_URL = 'https://slack.com/api/conversations.history';
const SLACK_CONVERSATIONS_REPLIES_URL = 'https://slack.com/api/conversations.replies';

export type SendSlackMessageResult =
  | { ok: true }
  | { ok: false; error: string };

export interface SlackHistoryMessage {
  ts: string;
  text?: string;
  user?: string;
  username?: string;
  thread_ts?: string;
  reply_count?: number;
  subtype?: string;
}

interface ChatPostMessageResponse {
  ok: boolean;
  error?: string;
}

interface ConversationsResponse {
  ok: boolean;
  error?: string;
  messages?: SlackHistoryMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

function buildSlackHeaders(botToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${botToken}`,
    'Content-Type': 'application/json; charset=utf-8',
  };
}

async function fetchSlackJson<T>(
  url: string,
  botToken: string,
  params: URLSearchParams,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: buildSlackHeaders(botToken),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
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
      headers: buildSlackHeaders(botToken),
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

export async function fetchSlackChannelMessages(
  botToken: string,
  params: {
    channel: string;
    oldest: string;
    latest: string;
    includeThreads?: boolean;
  },
): Promise<SlackHistoryMessage[]> {
  const messages: SlackHistoryMessage[] = [];
  let cursor = '';

  do {
    const searchParams = new URLSearchParams({
      channel: params.channel,
      oldest: params.oldest,
      latest: params.latest,
      inclusive: 'true',
      limit: '200',
    });
    if (cursor) searchParams.set('cursor', cursor);

    const body = await fetchSlackJson<ConversationsResponse>(
      SLACK_CONVERSATIONS_HISTORY_URL,
      botToken,
      searchParams,
      HISTORY_REQUEST_TIMEOUT_MS,
    );

    if (!body.ok) {
      throw new Error(body.error ?? 'unknown slack history error');
    }

    messages.push(...(body.messages ?? []));
    cursor = body.response_metadata?.next_cursor ?? '';
  } while (cursor);

  if (!params.includeThreads) {
    return messages;
  }

  const threadReplies: SlackHistoryMessage[] = [];
  for (const message of messages) {
    if (!message.reply_count || message.reply_count <= 0) continue;

    const searchParams = new URLSearchParams({
      channel: params.channel,
      ts: message.ts,
      limit: '200',
    });

    const body = await fetchSlackJson<ConversationsResponse>(
      SLACK_CONVERSATIONS_REPLIES_URL,
      botToken,
      searchParams,
      HISTORY_REQUEST_TIMEOUT_MS,
    );

    if (!body.ok) continue;

    for (const reply of body.messages ?? []) {
      if (reply.ts === message.ts) continue;
      threadReplies.push({ ...reply, thread_ts: message.ts });
    }
  }

  return [...messages, ...threadReplies];
}
