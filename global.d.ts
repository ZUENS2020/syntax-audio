export {};

declare global {
  interface Window {
    api?: {
      fetchUrl: (url: string) => Promise<string>;
    };
  }
}
