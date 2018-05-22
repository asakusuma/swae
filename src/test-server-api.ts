export interface TestServerApi {
  rootUrl: string;
  close: () => void;
  reset: () => Promise<void>;
}