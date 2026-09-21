import 'dotenv/config';
import { createApp } from './server/app.js';
import { createJevHandler } from './server/jev.js';

const port = Number(process.env.PORT || 4173);
const app = createApp({ jevHandler: createJevHandler() });

app.listen(port, '127.0.0.1', () => {
  console.log(`木乃伊迷宫已启动：http://127.0.0.1:${port}`);
});
