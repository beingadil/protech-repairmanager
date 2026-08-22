export interface ProdataBridge {
  db: {
    query(sql: string, params?: unknown[]): Promise<unknown[]>;
    execute(sql: string, params?: unknown[]): Promise<{ ok: true }>;
    exportBinary(): Promise<Uint8Array>;
    importBinary(bytes: Uint8Array | number[]): Promise<{ ok: true }>;
    resetProduction(): Promise<{ ok: true }>;
    getPath(): Promise<string>;
  };
  app: {
    getUserDataPath(): Promise<string>;
  };
  drive: {
    syncToFolder(bytes: number[], folder: string): Promise<{
      success: boolean;
      filePath: string;
      bytesWritten: number;
      error?: string;
    }>;
    chooseFolder(): Promise<string | null>;
  };
  updater: {
    check(manual?: boolean): Promise<{ ok: boolean; error?: string }>;
    install(): Promise<void>;
    canCheck(): Promise<boolean>;
    onEvent(cb: (e: UpdateEvent) => void): () => void;
  };
}

export type UpdateEventType =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'progress'
  | 'downloaded'
  | 'error';

export interface UpdateEvent {
  type: UpdateEventType;
  manual: boolean;
  info?: { version?: string; releaseDate?: string };
  percent?: number;
  error?: string;
}

declare global {
  interface Window {
    prodata?: ProdataBridge;
  }
}

export {};
