import { encrypted } from './encrypted'
import { createSecretKey } from 'crypto'
import { jwtVerify, SignJWT } from 'jose'
import { User } from 'discord.js'

const key = encrypted`D+XyV/JDZyFel9eaizc8/4PRSJO/oGT0.zWGSoe4sUwQ4ym0Amo5LB9KYdK5KG
  gSn4e9lFjoPCLCD6G8wWHy36LXYY5FKoLYpsos=`

const secretKey = createSecretKey(key, 'utf-8')

export async function mintIdToken(user: User, audience: string) {
  const token = await new SignJWT({ sub: `discord${user.id}`, name: user.tag })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('showdownspace-bot')
    .setAudience(audience)
    .setExpirationTime('60 minutes')
    .sign(secretKey)
  return token
}

export async function verifyIdToken(token: string, audience: string) {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
    issuer: 'showdownspace-bot',
    audience: audience,
  })
  return {
    discordId: payload.sub!.slice(7),
    discordTag: payload.name as string,
  }
}
