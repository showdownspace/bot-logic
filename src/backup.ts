import { Readable } from 'stream'
import { BotContext } from './types'

export async function writeBackup(
  context: BotContext,
  suffix: string,
  data: any,
) {
  const date = new Date()
    .toISOString()
    .replace(/[-:]/g, '-')
    .replace(/\.\d+/, '')
  const filename = `${date} ${suffix}.json`
  const { google } = context
  const drive = google.drive('v3')
  await drive.files.create({
    requestBody: {
      name: filename,
      parents: ['1WjNJnEjyIBxnJEbWEda63Zf3ry_8gbZc'],
    },
    media: {
      mimeType: 'text/plain',
      body: Readable.from([toBuffer(data)]),
    },
    fields: 'id',
  })
  return filename
}

function toBuffer(data: any) {
  if (data instanceof Buffer) {
    return data
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data)
  }
  if (typeof data === 'string') {
    return Buffer.from(data)
  }
  return Buffer.from(JSON.stringify(data, null, 2))
}
