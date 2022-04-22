import { encrypted } from './encrypted'
import { createPublicKey, createPrivateKey } from 'crypto'
import { jwtVerify, SignJWT } from 'jose'
import { User } from 'discord.js'

const publicKey = createPublicKey(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAvDejbyiuwv4q4sFu5WbaXaZukH4R60PB2v9uNbiPRwc=
-----END PUBLIC KEY-----`)

const privateKey = createPrivateKey(
  encrypted`1iAx/wn3xsbZ0maxHR+TLmACzPeVifJe.b2JXJQVZikZ1usyl9bPneeY+COUwo
  MCLEYXC999I4OCFNtiTg4CckMcRYzDHQ5Y39+P9pX91wUFoomSyd5Jh462rV3l75da2xW5L9
  cbbjfEMEEbVMLXrqXBybODy/8Eaq89Cx/C756QBKHeYGFS38G2zi+7X7KHJ5FETYznBh3stH
  nNa2VpCGbnO`,
)

export async function mintIdToken(user: User, audience: string) {
  const token = await new SignJWT({ sub: `discord${user.id}`, name: user.tag })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setIssuer('showdownspace-bot')
    .setAudience(audience)
    .setExpirationTime('60 minutes')
    .sign(privateKey)
  return token
}

export async function verifyIdToken(token: string, audience: string) {
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ['EdDSA'],
    issuer: 'showdownspace-bot',
    audience: audience,
  })
  return {
    discordId: payload.sub!.slice(7),
    discordTag: payload.name as string,
  }
}
