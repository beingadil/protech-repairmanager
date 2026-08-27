export interface ProdataBridge {
  db: {
    query(sql: string, params?: unknown[]): Promise<unknown[]>;
    execute(sql: string, params?: unknown[]): Promise<{ ok: true }>;
    batch(ops: Array<{ sql: string; params?: unknown[] }>): Promise<unknown[]>;
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
  print: {
    getPrinters(): Promise<
      Array<{ name: string; displayName: string; isDefault: boolean; status: number }>
    >;
    printDocument(payload: {
      html: string;
      format: 'a4' | 'thermal80' | 'thermal58';
      deviceName?: string;
    }): Promise<{ ok: true }>;
    savePdf(payload: {
      html: string;
      format: 'a4' | 'thermal80' | 'thermal58';
      fileName?: string;
    }): Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }>;
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
