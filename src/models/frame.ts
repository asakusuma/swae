import {
  Network,
  Page
} from 'chrome-debugging-client/dist/protocol/tot';

/**
 * Represents a frame transition from one page to another
 * @public
 */
export class FrameNavigation {
  private resolve: (res: Network.ResponseReceivedParameters[]) => void;
  private promise: Promise<Network.ResponseReceivedParameters[]>;
  private outstandingRequests: Set<string>;
  private responses: Network.ResponseReceivedParameters[];
  private waitForLoad: boolean;
  private onLoadEventFired: boolean;

  constructor(waitForLoad: boolean) {
    this.outstandingRequests = new Set();
    this.responses = [];
    this.waitForLoad = waitForLoad;
    this.onLoadEventFired = false;

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

  onRequestWillBeSent(req: Network.RequestWillBeSentParameters) {
    this.outstandingRequests.add(req.requestId);
  }

  resolveIfComplete() {
    if (this.onLoadEventFired && this.outstandingRequests.size === 0) {
      this.resolve(this.responses);
    }
  }

  onNetworkResponse(res: Network.ResponseReceivedParameters) {
    this.responses.push(res);
    this.outstandingRequests.delete(res.requestId);
    this.resolveIfComplete();
  }

  onNavigationComplete() {
    if (!this.waitForLoad) {
      this.resolve(this.responses);
    }
  }

  getPromise(): Promise<Network.ResponseReceivedParameters[]> {
    return this.promise;
  }

  onLoadEvent() {
    this.onLoadEventFired = true;
    this.resolveIfComplete();
  }
}

/**
 * Keeps track of in-flight navigations of various frames
 * @public
 */
export class FrameStore {
  private frames: { [frameId: string]: FrameNavigation };

  constructor() {
    this.frames = {};
  }
  start(frameId: string, waitForLoad: boolean): Promise<Network.ResponseReceivedParameters[]> {
    const nav = new FrameNavigation(waitForLoad);
    this.frames[frameId] = nav;
    const navPromise = nav.getPromise();
    return navPromise;
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
  onRequestWillBeSent(req: Network.RequestWillBeSentParameters) {
    if (req.frameId) {
      const nav = this.frames[req.frameId];
      if (nav) {
        nav.onRequestWillBeSent(req);
      }
    } else {
      throw new Error('Received "request will be sent" event without frameId');
    }
  }
  onNavigationComplete(result: Page.FrameNavigatedParameters) {
    const nav = this.frames[result.frame.id];
    if (nav) {
      nav.onNavigationComplete();
    }
  }

  onLoadEvent() {
    Object.keys(this.frames).forEach((frameId) => {
      this.frames[frameId].onLoadEvent();
    });
  }
}