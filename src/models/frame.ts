import { Network, Page } from "chrome-debugging-client/dist/protocol/tot";

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

export class FrameStore {
  private frames: { [frameId: string]: FrameNavigation };
  
  constructor() {
    this.frames = {};
  }
  start(frameId: string) {
    const nav = new FrameNavigation();
    this.frames[frameId] = nav;
    return nav.getPromise();
  }
  onNetworkResponse(res: Network.ResponseReceivedParameters) {
    if (res.frameId) {
      const nav = this.frames[res.frameId];
      if (nav) {
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
}

export interface PageNavigateResult {
  networkResult: Network.ResponseReceivedParameters;
  frame: Page.Frame;
};

export interface NavigateResult extends PageNavigateResult {
  body: Network.GetResponseBodyReturn;
}