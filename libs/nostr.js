import { nip19 } from "nostr-tools"

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
  