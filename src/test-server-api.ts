/**
 * The base API of a test server, expected by the TestSession
 * @public
 */
export interface TestServerApi {
  rootUrl: string;
  close: () => void;
  reset: () => Promise<void>;
}