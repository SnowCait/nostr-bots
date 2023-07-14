import { Kind, SimplePool, getEventHash, getPublicKey, getSignature, nip19 } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey } from '../libs/nostr.js';
import relays from '../resources/relays.search.json' assert { type: 'json' };

const nsecKey = 'nostr-search-bot-nsec';

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const fromRegexp = /from:nostr:(npub1[a-z0-9]{6,})/g;
  const kindRegexp = /kind:(\d+)/g;
  const fromMatches = requestEvent.content.matchAll(fromRegexp)
  const kindMatches = requestEvent.content.matchAll(kindRegexp)
  const pubkeys = [...fromMatches].map(match => match[1]).map(npub => nip19.decode(npub).data)
  const kinds = [...kindMatches].map(match => Number(match[1]))
  if (kinds.length === 0) {
    kinds.push(Kind.Text)
  }
  const keyword = requestEvent.content
    .replace('nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x', '')
    .replace(fromRegexp, '')
    .trim();
  if (keyword === '') {
    console.warn('[invalid content]', requestEvent.content);
    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', requestEvent.id, '', 'root'],
        ['p', requestEvent.pubkey]
      ],
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
  let filter = {
    search: keyword,
    kinds
  };
  if (pubkeys.length > 0) {
    filter.authors = pubkeys
  }
  console.log('[filter]', filter);

  if (filter.limit === undefined || filter.limit > 10) {
    filter.limit = 10;
  }

  if (filter.until === undefined) {
    filter.until = requestEvent.created_at - 1;
  }

  const pool = new SimplePool()
  const events = await pool.list(relays, [filter])
  console.log('[events]', events)

  const event = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', requestEvent.id, '', 'root'],
      ['p', requestEvent.pubkey]
    ],
    content: events.map(event => `nostr:${nip19.neventEncode({id: event.id})}`).join('\n'),
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
