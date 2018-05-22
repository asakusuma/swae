import { Server } from 'http';
import boot, { IServerApi } from './boot';

export class ExpressTestServer implements IServerApi {
  public rootUrl: string;
  private server: Server;
  private version: number;
  constructor() {
    this.version = 0;
  }
  attach(server: Server, port: number) {
    this.server = server;
    this.rootUrl = `http://localhost:${port}`;
    return this;
  }
  close() {
    return this.server.close();
  }
  reset() {
    return Promise.resolve();
  }

  incrementVersion() {
    this.version++;
  }

  getWorkerVersion() {
    return String(this.version);
  }
}

export function createServer(): Promise<IServerApi> {
  const EXPRESS_PORT = 5000;
  const serverApi = new ExpressTestServer();
  const server = boot(serverApi);

  return new Promise((resolve) => {
    const handle = server.listen(EXPRESS_PORT, () => {
      resolve(serverApi.attach(handle, EXPRESS_PORT));
    });
  });
}

const serverApi = new ExpressTestServer();

const EXPRESS_PORT = 3000;

const server = boot(serverApi);

const handle = server.listen(EXPRESS_PORT, () => {
  serverApi.attach(handle, EXPRESS_PORT);
  console.log(`App listening on port ${EXPRESS_PORT}`);
});
