import { getEventHash, getPublicKey, getSignature } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey, replyTags } from '../libs/nostr.js';

const nsecKey = 'nostr-test-bot-nsec';

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const match = requestEvent.content.match(/\b(?<number>[1-9]\d*)d(?<face>[1-9]\d*)\b/)
  const number = Number(match.groups.number)
  const face = Number(match.groups.face)

  const dices = Array.from(
    {length: number},
    (v, i) => Math.floor(Math.random() * face)
  )
  const sum = dices.reduce((sum, dice) => sum + dice + 1, 0)
  console.log('[dices]', dices, sum)

  let content = face === 6
    ? dices.map(dice => `:mahjong_dice${dice + 1}:`).join('')
    : dices.map(dice => dice + 1).join(', ')
  if (number > 1) {
    content += `\nSum: ${sum}`
  }

  const tags = replyTags(requestEvent);
  if (face === 6) {
    tags.push(...dices.map(dice => ['emoji', `mahjong_dice${dice + 1}`, `https://awayuki.github.io/emoji/mahjong-dice${dice + 1}.png`]))
  }
  const event = {
    kind: requestEvent.kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
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
