import { SimplePool, getEventHash, getPublicKey, getSignature, nip19 } from 'nostr-tools';
import 'websocket-polyfill'
import { getSeckey, publish, relays, replyTags } from '../libs/nostr.js';

const nsecKey = 'nostr-test-bot-nsec';

const now = () => Math.floor(Date.now() / 1000);

export const register = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const match = requestEvent.content.match(/(?<method>create|add|作成|追加)\s+(?<title>.+画像)(\s+nostr:(?<nevent>(nevent|note)1\w{6,}))?/u)
  console.log('[match]', match)

  if (match === null) {
    return {
      statusCode: 400
    }
  }

  /** @type {string} */
  const method = match.groups.method
  /** @type {string} */
  const title = match.groups.title
  /** @type {string} */
  const nevent = match.groups.nevent

  let content = 'error'
  switch (method) {
    case 'create':
    case '作成': {
      content = await create(title, seckey, pubkey, requestEvent)
      break;
    }

    case 'add':
    case '追加':
      if (nevent !== undefined) {
        content = await add(title, nevent, seckey, pubkey, requestEvent)
      }
      break;

    default:
      break;
  }

  const event = {
    kind: requestEvent.kind,
    created_at: now(),
    tags: replyTags(requestEvent),
    content,
    pubkey
  }
  console.log('[unsigned event]', event)

  event.id = getEventHash(event)
  event.sig = getSignature(event, seckey)
  console.log('[event]', event)

  return {
    statusCode: 200,
    body: JSON.stringify(event)
  };
};

export const draw = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  /** @type {import('nostr-tools').Event} */
  const requestEvent = JSON.parse(json)

  const seckey = await getSeckey(nsecKey)
  const pubkey = getPublicKey(seckey)

  const match = requestEvent.content.match(/^.+画像$/u)
  console.log('[match]', match)

  if (match === null) {
    return {
      statusCode: 400
    }
  }

  /** @type {string} */
  const title = match[0]
  const identifier = escapeIdentifier(title)
  const kind = 30023
  const naddrEvent = await fetchNaddr(kind, pubkey, identifier)
  console.log('[event 30023]', naddrEvent)
  if (naddrEvent === undefined) {
    return {
      statusCode: 404
    }
  }

  const urls = findUrls(naddrEvent)
  const content = urls.length > 0
    ? urls[Math.floor(Math.random() * urls.length)]
    : `no content in nostr:${nip19.naddrEncode({kind, pubkey, identifier, relays})}`

  const event = {
    kind: requestEvent.kind,
    created_at: now(),
    tags: replyTags(requestEvent),
    content,
    pubkey
  }
  console.log('[unsigned event]', event)

  event.id = getEventHash(event)
  event.sig = getSignature(event, seckey)
  console.log('[event]', event)

  return {
    statusCode: 200,
    body: JSON.stringify(event)
  };
};

/**
 * @param {string} title
 * @param {string} seckey
 * @param {string} pubkey
 * @param {import('nostr-tools').Event} requestEvent
 * @returns {string}
 */
async function create(title, seckey, pubkey, requestEvent) {
  const identifier = escapeIdentifier(title)
  console.log('[create]', title, identifier)

  const lastEvent = await fetchNaddr(identifier, pubkey)
  if (lastEvent !== undefined) {
    return 'already exists'
  }

  const kind = 30023
  const created_at = now()

  const event = {
    kind,
    created_at,
    tags: [
      ['d', identifier],
      ['title', title],
      ['summary', `Created by nostr:${nip19.npubEncode(requestEvent.pubkey)}`]
      ['published_at', created_at.toString()],
      ['t', title]
    ],
    content: '',
    pubkey
  }

  event.id = getEventHash(event)
  event.sig = getSignature(event, seckey)
  console.log('[event 30023]', event)

  if (await publish(event)) {
    return `nostr:${nip19.naddrEncode({kind, pubkey, identifier, relays})}`
  } else {
    return 'error'
  }
}

/**
 * @param {string} title
 * @param {string} nevent
 * @param {string} seckey
 * @param {string} pubkey
 * @param {import('nostr-tools').Event} requestEvent
 * @returns {string}
 */
async function add(title, nevent, seckey, pubkey, requestEvent) {
  const identifier = escapeIdentifier(title)
  console.log('[add]', title, identifier, nevent)

  const kind = 30023
  const event = await fetchNaddr(kind, pubkey, identifier)
  console.log('[last event]', event)

  if (event === undefined) {
    return 'not found'
  }

  /** @type {string} */
  let id;
  try {
    const {type, data} = nip19.decode(nevent)
    id = type === 'nevent' ? data.id : data
  } catch (error) {
    return 'invalid nevent'
  }

  const referencedEvent = await fetchEvent(id)
  if (referencedEvent === undefined) {
    return `${nevent} (${id}) not found`
  }

  const urls = findUrls(referencedEvent);

  if (!event.content.includes(nevent) && urls.length > 0 && urls.some(url => !event.content.includes(url))) {
    if (event.content !== '') {
      event.content += '\n'
    }
    event.content += `Added by nostr:${nip19.npubEncode(requestEvent.pubkey)}\n`
    event.content += `nostr:${nevent}\n${urls.filter(url => !event.content.includes(url)).join('\n')}`
  } else {
    return 'already exists or url not found'
  }

  event.id = getEventHash(event)
  event.sig = getSignature(event, seckey)
  console.log('[event 30023]', JSON.stringify(event))

  if (await publish(event)) {
    return `nostr:${nip19.naddrEncode({kind, pubkey, identifier, relays})}`
  } else {
    return 'error'
  }
}

function findUrls(event) {
  const matches = event.content.matchAll(/https:\/\/\S+/g);
  return [...matches].map(match => match[0]);
}

async function fetchNaddr(kind, pubkey, identifier) {
  const pool = new SimplePool()
  const events = await pool.list(relays, [
    {
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier]
    }
  ])
  events.sort((x, y) => y.created_at - x.created_at)
  return events.length > 0 ? events[0] : undefined
}

async function fetchEvent(id) {
  const pool = new SimplePool()
  const event = await pool.get(relays, {
    ids: [id]
  })
  return event ?? undefined
}

function escapeIdentifier(identifier) {
  return Buffer.from(identifier).toString('base64')
}
