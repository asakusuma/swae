import {
  Network,
  Target
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient } from 'chrome-debugging-client';
import createTargetConnection from 'chrome-debugging-client/dist/lib/create-target-connection';

export async function emulateOffline(network: Network) {
  await network.emulateNetworkConditions({
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
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

export async function clientEmulateOffline(client: IDebuggingProtocolClient): Promise<any> {
  return forEachTarget(client, (c) => {
    return emulateOffline(new Network(c));
  });
}

export type ClientCallback = (c: IDebuggingProtocolClient) => Promise<void>;

export async function forEachTarget(client: IDebuggingProtocolClient, cb: ClientCallback): Promise<any> {
  const t = new Target(client);
  const targets = await t.getTargets();
  if (!targets.targetInfos) {
    return Promise.resolve();
  }
  const connections = await targets.targetInfos.map((target) => getClientForTarget(client, t, target));
  return Promise.all(connections.map(async (connection) => {
    const targetClient = await connection;
    await cb(targetClient);
    return clientEmulateOffline(targetClient);
  }));
}

async function getClientForTarget(client: IDebuggingProtocolClient, t: Target, target: Target.TargetInfo) {
  const { sessionId } = await t.attachToTarget({
    targetId: target.targetId
  });
  return createTargetConnection(client, sessionId);
}