import {
  Network,
  Target
} from 'chrome-debugging-client/dist/protocol/tot';
import { IDebuggingProtocolClient, ISession } from 'chrome-debugging-client';

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

export async function clientEmulateOffline(session: ISession, client: IDebuggingProtocolClient): Promise<any> {
  return forEachTarget(session, client, (c) => {
    return emulateOffline(new Network(c));
  });
}

export type ClientCallback = (c: IDebuggingProtocolClient) => Promise<void>;

export async function forEachTarget(
  session: ISession,
  client: IDebuggingProtocolClient,
  cb: ClientCallback
): Promise<any> {
  const t = new Target(client);
  const targets = await t.getTargets();
  if (!targets.targetInfos) {
    return Promise.resolve();
  }
  const clients = await targets.targetInfos.map((target) => getClientForTarget(session, client, t, target));
  return Promise.all(clients.map(async (connection) => {
    const targetClient = await connection;
    await cb(targetClient);
    return clientEmulateOffline(session, targetClient);
  }));
}

async function getClientForTarget(
  session: ISession,
  client: IDebuggingProtocolClient,
  t: Target, target: Target.TargetInfo
) {

  // Use createTargetSessionClient instead
  const { sessionId } = await t.attachToTarget({
    targetId: target.targetId
  });
  return session.createTargetSessionClient(client, sessionId);
}