export interface ProdataBridge {
  sqlWasm: {
    get(): Promise<number[] | null>;
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
