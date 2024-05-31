import { SimplePool } from 'nostr-tools'
import 'websocket-polyfill'
import relays from '../resources/relays.json' assert { type: 'json' };

export const handler = async (e) => {
  console.log('[request]', JSON.stringify(e))
  const json = e.isBase64Encoded ? Buffer.from(e.body, 'base64').toString() : e.body
  console.log('[request event]', json)

  const event = JSON.parse(json)

  await new Promise((resolve)=>{
    const pool = new SimplePool()
    const relayMap = new Map()
    const pub = pool.publish(relays, event)
    const close = () => {
      console.log(relayMap)
      resolve()
    }
    const cancelId = setTimeout(close, 1000)
    const closeIfComplete = () => {
      if (relays.length === relayMap.size) {
        clearTimeout(cancelId)
        close()
      }
    }
    pub.on('ok', (relay) => {
      console.log(relay)
      relayMap.set(relay, true)
      closeIfComplete()
    })
    pub.on('failed', (relay) => {
      console.error(relay)
      relayMap.set(relay, false)
      closeIfComplete()
    })
  })

  return {
    statusCode: 200,
    body: ''
  }
}
