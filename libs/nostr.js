import { nip19 } from "nostr-tools"

export function replyTags(event) {
  const tags = []

  // e tags
  const rootTag = event.tags.find(([tagName, , , marker]) => tagName === 'e' && marker === 'root')
  console.log('[root tag]', rootTag)
  if (rootTag !== undefined) {
    tags.push(rootTag, ['e', event.id, '', 'reply'])
  } else {
    tags.push(['e', event.id, '', 'root'])
  }

  // p tags
  const pTags = event.tags.filter(([tagName]) => tagName === 'p')
  if (pTags.some(([, pubkey]) => pubkey === event.pubkey)) {
    tags.push(...pTags)
  } else {
    tags.push(...pTags, ['p', event.pubkey])
  }

  return tags
}

export async function getSeckey(name) {
  const nsec = await getNsec(name)
  const { type, data: seckey } = nip19.decode(nsec)

  if (type !== 'nsec' || typeof seckey !== 'string') {
    throw new Error(`[invalid nsec] type: ${type}, typeof seckey: ${typeof seckey}`)
  }

  return seckey
}

async function getNsec (name) {
  const response = await fetch(`http://localhost:2773/systemsmanager/parameters/get?name=${name}&withDecryption=true`, {
    method: 'GET',
    headers: {
      'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN
    }
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const secrets = await response.json()
  return secrets.Parameter.Value
}
