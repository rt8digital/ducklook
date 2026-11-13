import { contextBridge, ipcRenderer } from 'electron';

export interface ApiInvokePayload {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
}

const bridge = {
  invoke: async (payload: ApiInvokePayload) => {
    try {
      return await ipcRenderer.invoke('api:invoke', payload);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '');
      throw new Error(message);
    }
  },
  saveAttachment: (messageId: string, attachmentId: string) =>
    ipcRenderer.invoke('attachment:save', { messageId, attachmentId }),
};

contextBridge.exposeInMainWorld('ducklookApi', bridge);

export type DuckLookApi = typeof bridge;
