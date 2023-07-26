import { Kind, SimplePool, getEventHash, getPublicKey, getSignature, nip19 } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey } from '../libs/nostr.js';
import readRelays from '../resources/relays.json' assert { type: 'json' };
import searchRelays from '../resources/relays.search.json' assert { type: 'json' };

const nsecKey = 'nostr-search-bot-nsec';

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const fromRegexp = /from:(nostr:)?(npub1[a-z0-9]{6,})/g
  const toRegexp = /to:(nostr:)?(npub1[a-z0-9]{6,})/g
  const kindRegexp = /kind:(\d+)/g
  const fromMatches = requestEvent.content.matchAll(fromRegexp)
  const toMatches = requestEvent.content.matchAll(toRegexp)
  const kindMatches = requestEvent.content.matchAll(kindRegexp)

  const fromPubkeys = [...fromMatches].map(match => match[2]).map(npub => nip19.decode(npub).data)
  const toPubkeys = [...toMatches].map(match => match[2]).map(npub => nip19.decode(npub).data)
  const hashtags = requestEvent.tags.filter(([tagName]) => tagName === 't').map(([, hashtag]) => hashtag)
  hashtags.sort((x, y) => y.length - x.length)
  const kinds = [...kindMatches].map(match => Number(match[1]))
  console.log('[matches]', fromPubkeys, toPubkeys, hashtags, kinds)
  if (kinds.length === 0) {
    kinds.push(Kind.Text)
  }
  const keyword = requestEvent.content
    .replace('nostr:npub1n2uhxrph9fgyp3u2xxqxhuz0vykt8dw8ehvw5uaesl0z4mvatpas0ngm26', '')
    .replaceAll(fromRegexp, '')
    .replaceAll(toRegexp, '')
    .replaceAll(kindRegexp, '')
    .replaceAll(new RegExp(`(${hashtags.map((x) => `#${x}`).join('|')})`, 'gu'), '')
    .trim();

  /** @param {import('nostr-tools').Filter} */
  let filter = {
    kinds
  };
  if (keyword.length > 0) {
    filter.search = keyword
  }
  if (fromPubkeys.length > 0) {
    filter.authors = fromPubkeys
  }
  if (toPubkeys.length > 0) {
    filter['#p'] = toPubkeys
  }
  if (hashtags.length > 0) {
    filter['#t'] = hashtags
  }
  console.log('[filter]', filter);

  if (filter.limit === undefined || filter.limit > 10) {
    filter.limit = 10;
  }

  if (filter.until === undefined) {
    filter.until = requestEvent.created_at - 1;
  }

  const relays = filter.search !== undefined ? searchRelays : readRelays;
  console.log('[relays]', relays);

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
    content: events.length === 0
      ? 'No results.'
      : events.map(event => `nostr:${nip19.neventEncode({id: event.id})}`).join('\n'),
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
