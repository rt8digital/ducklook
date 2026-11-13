export interface ApiInvokePayload {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

declare global {
  interface Window {
    ducklookApi: {
      invoke: (payload: ApiInvokePayload) => Promise<unknown>;
      saveAttachment: (
        messageId: string,
        attachmentId: string
      ) => Promise<{ saved: boolean; path?: string }>;
    };
  }
}

export {};
