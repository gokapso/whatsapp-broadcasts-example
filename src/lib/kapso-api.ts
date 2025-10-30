import type {
  CreateBroadcastRequest,
  AddRecipientsRequest,
  WhatsappBroadcast,
  WhatsappBroadcastRecipient,
  RecipientBatchResponse,
  PaginationMeta,
  Template,
} from '@/types';

const KAPSO_PLATFORM_API_BASE = 'https://api.kapso.ai/platform/v1';
const KAPSO_META_WHATSAPP_API_BASE = 'https://api.kapso.ai/meta/whatsapp/v23.0';

if (!process.env.KAPSO_API_KEY) {
  throw new Error('KAPSO_API_KEY is not set');
}

type KapsoApiOptions<T = unknown> = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: T;
  params?: Record<string, string | number>;
  apiBase?: 'platform' | 'meta';
};

type ApiResponse<T> = {
  data: T;
};

type ApiListResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

async function kapsoFetch<T = unknown, B = unknown>(
  endpoint: string,
  options: KapsoApiOptions<B> = {}
): Promise<T> {
  const { method = 'GET', body, params, apiBase = 'platform' } = options;

  const baseUrl = apiBase === 'meta' ? KAPSO_META_WHATSAPP_API_BASE : KAPSO_PLATFORM_API_BASE;
  let url = `${baseUrl}${endpoint}`;

  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: HeadersInit = {
    'X-API-Key': process.env.KAPSO_API_KEY!,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const responseText = await response.text();

    let errorData;
    try {
      errorData = JSON.parse(responseText);
    } catch {
      errorData = { error: 'Unknown error' };
    }

    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }

  return response.json();
}

export const kapsoApi = {
  broadcasts: {
    create: (data: CreateBroadcastRequest) =>
      kapsoFetch<ApiResponse<WhatsappBroadcast>, CreateBroadcastRequest>('/whatsapp/broadcasts', {
        method: 'POST',
        body: data,
      }),
    get: (broadcastId: string) =>
      kapsoFetch<ApiResponse<WhatsappBroadcast>>(`/whatsapp/broadcasts/${broadcastId}`),
    addRecipients: (broadcastId: string, data: AddRecipientsRequest) =>
      kapsoFetch<ApiResponse<RecipientBatchResponse>, AddRecipientsRequest>(
        `/whatsapp/broadcasts/${broadcastId}/recipients`,
        { method: 'POST', body: data }
      ),
    getRecipients: (broadcastId: string, page: number = 1, perPage: number = 20) =>
      kapsoFetch<ApiListResponse<WhatsappBroadcastRecipient>>(
        `/whatsapp/broadcasts/${broadcastId}/recipients`,
        { params: { page, per_page: perPage } }
      ),
    send: (broadcastId: string) =>
      kapsoFetch<ApiResponse<WhatsappBroadcast>>(`/whatsapp/broadcasts/${broadcastId}/send`, {
        method: 'POST',
      }),
  },
  templates: {
    list: (businessAccountId: string, params?: Record<string, string | number>) =>
      kapsoFetch<ApiListResponse<Template>>(
        `/${businessAccountId}/message_templates`,
        { params, apiBase: 'meta' }
      ),
    get: (businessAccountId: string, templateId: string) =>
      kapsoFetch<ApiResponse<Template>>(
        `/${businessAccountId}/message_templates/${templateId}`,
        { apiBase: 'meta' }
      ),
  },
};
