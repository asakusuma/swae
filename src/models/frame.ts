import { Network, Page } from 'chrome-debugging-client/dist/protocol/tot';

/**
 * Represents a frame transition from one page to another
 * @public
 */
export class FrameNavigation {
  private response: Network.ResponseReceivedParameters;
  private resolve: (res: PageNavigateResult) => void;
  private promise: Promise<PageNavigateResult>;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 10000);
      this.resolve = (res) => {
        clearTimeout(timeout);
        resolve(res);
      };
    });
  }
  onNetworkResponse(res: Network.ResponseReceivedParameters) {
    this.response = res;
  }
  onNavigationComplete({ frame }: Page.FrameNavigatedParameters) {
    this.resolve({
      frame,
      networkResult: this.response
    });
  }
  getPromise(): Promise<PageNavigateResult> {
    return this.promise;
  }
}

/**
 * Keeps track of in-flight navigations of various frames
 * @public
 */
export class FrameStore {
  private frames: { [frameId: string]: FrameNavigation };
  private loadResolver: () => void;

  constructor() {
    this.frames = {};
  }
  start(frameId: string, waitForLoad: boolean = false): Promise<PageNavigateResult> {
    const nav = new FrameNavigation();
    this.frames[frameId] = nav;
    const navPromise = nav.getPromise();
    return waitForLoad ?
      Promise.all([navPromise, new Promise((r) => { this.loadResolver = r; })]).then(([n]) => n) :
      navPromise;
  }
  onNetworkResponse(res: Network.ResponseReceivedParameters) {
    if (res.frameId) {
      const nav = this.frames[res.frameId];
      // TODO: Figure out why sometimes we recieve a bogus requestId that is a
      // decimal number represented as a string
      if (nav && res.requestId.indexOf('.') < 0) {
        nav.onNetworkResponse(res);
      }
    } else {
      throw new Error('Received network response without frameId');
    }
  }
  onNavigationComplete(result: Page.FrameNavigatedParameters) {
    const nav = this.frames[result.frame.id];
    if (nav) {
      nav.onNavigationComplete(result);
    }
  }
  onLoadEvent() {
    if (this.loadResolver) {
      this.loadResolver();
    }
  }
}

/**
 * Represents the result of a navigation
 * @public
 */
export interface PageNavigateResult {
  networkResult: Network.ResponseReceivedParameters;
  frame: Page.Frame;
}

/**
 * Represents the result of a navigation that includes a body response
 * @public
 */
export interface NavigateResult extends PageNavigateResult {
  body: Network.GetResponseBodyReturn;
}