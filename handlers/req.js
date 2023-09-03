import { SimplePool, getEventHash, getPublicKey, getSignature } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey, replyTags } from '../libs/nostr.js';
import relays from '../resources/relays.json' assert { type: 'json' };

const nsecKey = 'nostr-req-bot-nsec';

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const match = requestEvent.content.match(/\{.+\}/)
  if (match === null) {
    console.warn('[invalid content]', requestEvent.content);
    const event = {
      kind: requestEvent.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: replyTags(requestEvent),
      content: 'Bad request.',
      pubkey
    }
  
    event.id = getEventHash(event)
    event.sig = getSignature(event, seckey)
    console.log('[event]', event)
  
    return {
      statusCode: 200,
      body: JSON.stringify(event)
    };
  }

  /** @param {import('nostr-tools').Filter} */
  let filter;
  try {
    filter = JSON.parse(match[0]);
    console.log('[filter]', filter);
  } catch (error) {
    console.warn('[invalid filter]', requestEvent.content);
    const event = {
      kind: requestEvent.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: replyTags(requestEvent),
      content: 'Bad filter.',
      pubkey
    }
  
    event.id = getEventHash(event)
    event.sig = getSignature(event, seckey)
    console.log('[event]', event)
  
    return {
      statusCode: 200,
      body: JSON.stringify(event)
    };
  }

  if (filter.limit === undefined || filter.limit > 5) {
    filter.limit = 5;
  }

  if (filter.until === undefined) {
    filter.until = requestEvent.created_at - 1;
  }

  const pool = new SimplePool();
  const events = await pool.list(relays, [filter]);

  const event = {
    kind: requestEvent.kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: replyTags(requestEvent),
    content: JSON.stringify(events, null, 2),
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
