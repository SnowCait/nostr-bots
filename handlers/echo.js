import 'websocket-polyfill'
import { getSeckey } from '../libs/nostr.js';

const nsecKey = 'nostr-test-bot-nsec';

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const match = requestEvent.content.match(/echo (.+)/)

  const event = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: match?.[1] ?? 'Error',
    pubkey
  }

  event.id = getEventHash(event)
  event.sig = getSignature(event, seckey)
  console.log('[event]', event)

  return {
    statusCode: 200,
    body: JSON.stringify(event)
  };
};
