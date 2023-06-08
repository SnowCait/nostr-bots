import { getEventHash, getPublicKey, getSignature } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey } from '../libs/nostr.js';
import { shuffle } from '../libs/array.js';

const nsecKey = 'nostr-test-bot-nsec';

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const tiles = true
    ? '🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓🀔🀕🀖🀗🀘🀙🀚🀛🀜🀝🀞🀟🀠🀡🀀🀁🀂🀃🀆🀅🀄'.repeat(4)
    : '一二三四五六七八九①②③④⑤⑥⑦⑧⑨１２３４５６７８９東南西北白發中'.repeat(4);
  const wall = [...tiles];
  shuffle(wall);
  console.log('[wall]', wall);
  const hand = wall.slice(0, 14);
  hand.sort();
  console.log('[hand]', hand);

  const event = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', requestEvent.id, '', 'root'],
      ['p', requestEvent.pubkey]
    ],
    content: hand.join(''),
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
