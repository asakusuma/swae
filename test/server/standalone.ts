import { ExpressTestServer } from './index';
import boot from './boot';

const serverApi = new ExpressTestServer();

const EXPRESS_PORT = 3000;

const server = boot(serverApi);

const handle = server.listen(EXPRESS_PORT, () => {
  serverApi.attach(handle, EXPRESS_PORT);
  console.log(`App listening on port ${EXPRESS_PORT}`);
});
