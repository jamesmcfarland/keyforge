import { Hono } from 'hono'
import { logger } from 'hono/logger';
import { pino, type Logger } from 'pino';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(process.env.DATABASE_URL!);
declare module 'hono' {
  interface ContextVariableMap {
    logger: Logger
    db: typeof db
  }
}






const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  },
});
const app = new Hono()


app.use(logger());

app.use(async (c, next) => {
  c.set('logger', pinoLogger);
  await next();
});

app.get('/', (c) => {
  const logger = c.get("logger");
  logger.info("heartbeat")
  return c.json({ message: "OK" })
})


export default app