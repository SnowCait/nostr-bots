import { getEventHash, getPublicKey, getSignature } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey } from '../libs/nostr.js';

const nsecKey = 'nostr-test-bot-nsec';
const sushiyukiUrl = 'https://awayuki.github.io/awayuki_emojis.json'
const customEmojiMode = false

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const sushiyukis = await fetchSushiyukis()
  const keys = [...sushiyukis.keys()]
  const i = Math.floor(Math.random() * sushiyukis.size)
  const key = keys[i]

  console.log('[selected]', key, sushiyukis.get(key))

  const event = customEmojiMode
    ? {
      kind: requestEvent.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', requestEvent.id, '', 'root'],
        ['p', requestEvent.pubkey],
        ['emoji', key, sushiyukis.get(key)]
      ],
      content: `:${key}:`,
      pubkey
    }
    : {
      kind: requestEvent.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', requestEvent.id, '', 'root'],
        ['p', requestEvent.pubkey]
      ],
      content: sushiyukis.get(key),
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

async function fetchSushiyukis() {
  const response = await fetch(sushiyukiUrl);
  if (!response.ok) {
    throw new Error('Sushiyuki not found')
  }
  const json = await response.json();
  return new Map(Object.entries(json))
}
