export type StorageAdapter = {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  delete(key: string): void;
};
