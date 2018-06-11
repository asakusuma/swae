import {
  Network,
  Target
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient, ISession } from 'chrome-debugging-client';

export async function emulateOffline(network: Network) {
  await network.emulateNetworkConditions({
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: 'none'
  });
}

export async function turnOffEmulateOffline(network: Network) {
  await network.emulateNetworkConditions({
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
}

export async function clientEmulateOffline(session: ISession, client: IDebuggingProtocolClient): Promise<any> {
  console.log('emulate 1');
  return forEachTarget(session, client, (c) => {
    console.log('start emulate');
    return emulateOffline(new Network(c));
  });
  console.log('emulate 2');
}

export async function turnOffClientEmulateOffline(session: ISession, client: IDebuggingProtocolClient): Promise<any> {
  return forEachTarget(session, client, (c) => {
    return emulateOffline(new Network(c));
  });
}

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
  console.log('got targetInfos');
  const clients = await Promise.all(targets.targetInfos.map(({ targetId }) => s.attachToTarget(client, targetId)));
  console.log('got clients');
  return Promise.all(clients.map(async (targetClient) => {
    console.log('got targetclient');
    await cb(targetClient);
    return clientEmulateOffline(s, targetClient);
  }));
}