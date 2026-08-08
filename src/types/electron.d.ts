export interface ProdataBridge {
  db: {
    query(sql: string, params?: unknown[]): Promise<unknown[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    executeRaw(sql: string): Promise<void>;
    export(): Promise<number[]>;
    restore(bytes: number[]): Promise<void>;
    reset(): Promise<void>;
    getInfo(): Promise<{ path: string; sizeBytes: number }>;
  };
  backup: {
    save(): Promise<{ canceled: boolean; filePath?: string; sizeBytes?: number }>;
    restore(): Promise<{ canceled: boolean; filePath?: string }>;
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
  app: {
    getUserDataPath(): Promise<string>;
  };
}

declare global {
  interface Window {
    prodata?: ProdataBridge;
  }
}

export {};
