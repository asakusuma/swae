import {
  Target
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient, ISession } from 'chrome-debugging-client';

/*
// Offline stuff doesn't work right now: https://bugs.chromium.org/p/chromium/issues/detail?id=852127
export async function emulateOffline(network: Network) {
  console.log('emulating network conditions');
  await network.emulateNetworkConditions({
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: 'none'
  });
}

export async function turnOffEmulateOffline(network: Network) {
  console.log('TURN OFF BAD');
  await network.emulateNetworkConditions({
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
}

export async function clientEmulateOffline(session: ISession, client: IDebuggingProtocolClient): Promise<any> {
  return forEachTarget(session, client, (c) => {
    return emulateOffline(new Network(c));
  });
}

export async function turnOffClientEmulateOffline(session: ISession, client: IDebuggingProtocolClient): Promise<any> {
  return forEachTarget(session, client, (c) => {
    return emulateOffline(new Network(c));
  });
}
*/

export type ClientCallback = (c: IDebuggingProtocolClient) => Promise<void>;

export async function forEachTarget(
  s: ISession,
  client: IDebuggingProtocolClient,
  cb: ClientCallback
): Promise<any> {
  const t = new Target(client);
  const targets = await t.getTargets();
  if (!targets.targetInfos) {
    return Promise.resolve();
  }
  const clients = await Promise.all(targets.targetInfos.map(({ targetId }) => s.attachToTarget(client, targetId)));
  return Promise.all(clients.map(async (targetClient) => {
    await cb(targetClient);
  }));
}