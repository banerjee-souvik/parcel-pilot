import { Redis } from "ioredis";

// One shared publisher/subscriber pair, not one per request — a single Redis connection handles
// many concurrent pub/sub channels fine, and reusing it avoids both the connection overhead and
// the pile of independently-retrying zombie clients a per-request client would leave behind once
// Redis goes down (each with its own background retry timer, still firing after the request ends).
function createClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  const client = new Redis(process.env.REDIS_URL, {
    // Never return null here: that permanently gives up on reconnecting, so a transient Redis
    // blip would leave resumability dead until the server restarts. Keep retrying, just slowly
    // (capped at 10s) — quiet during an outage, self-heals once Redis comes back.
    retryStrategy: (attempt) => Math.min(attempt * 500, 10000),
    maxRetriesPerRequest: 1, // per-command: fail fast so a down Redis never blocks the chat response
  });
  // ioredis logs "Unhandled error event" to the console for every connection failure unless
  // something is listening for 'error' — callers detect a dead connection via failed operations,
  // not this listener, so it's intentionally a no-op.
  client.on("error", () => {});
  return client;
}

export const redisPublisher = createClient();
export const redisSubscriber = createClient();
