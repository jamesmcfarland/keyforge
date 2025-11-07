import { Hono } from 'hono'
import { pinoLogger } from 'hono-pino'

const app = new Hono()

app.use(pinoLogger({
  pino: {
    level: "debug"
  }
}))

app.get('/', (c) => {
  const logger = c.var;

  return c.json({ message: 'Hello Hono!' })
})

export default app
