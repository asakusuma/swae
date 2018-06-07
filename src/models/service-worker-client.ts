import {
  Network
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient } from 'chrome-debugging-client';

/**
 * Models a service worker client
 * @public
 */
export class ServiceWorkerEnvironment {
  public network: Network;

  // private debuggerClient: IDebuggingProtocolClient;

  private constructor(debuggerClient: IDebuggingProtocolClient) {
    // this.debuggerClient = debuggerClient;
    this.network = new Network(debuggerClient);
  }

  public static async build(debuggerClient: IDebuggingProtocolClient) {
    const instance = new ServiceWorkerEnvironment(debuggerClient);
    await instance.network.enable({});
    return instance;
  }

  public async close() {
    await this.network.disable();
  }
}