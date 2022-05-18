import { User } from 'discord.js'
import { encrypted } from './encrypted'
import { mintIdToken } from './id-token'
import axios from 'axios'
import { enhanceError } from './enhance-error'

const GITHUB_CLIENT_ID = '4174f6d4dac12fc712ec'

const GITHUB_CLIENT_SECRET = encrypted`
cR+XPt/pf3Los7eGa0oLicOAICYeDK95.inCkXVAmKnw32o6TBDvyo0j3PJCpj
ltfET78Hz3X7HmN2xBe5XsfhCYio9YrOUttpOQbU/6d9FDIwg==`

// const REDIRECT_URI = `https://bot.showdown.space/showdown?action=callback/github`
// const REDIRECT_URI = `https://showdownspace-bot.fly.dev/showdown?action=callback/github`
const REDIRECT_URI = `https://showdownspace-bot.wonderful.software/showdown?action=callback/github`

export async function getGitHubAuthorizeUrl(user: User): Promise<string> {
  const state = await mintIdToken(user, 'showdownspace-bot/github-linking')
  return `https://github.com/login/oauth/authorize?${new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: state,
  })}`
}

export async function verifyGitHubCode(code: string) {
  const url = `https://github.com/login/oauth/access_token?${new URLSearchParams(
    {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    },
  )}`
  const response = await axios
    .post(url, {}, { headers: { Accept: 'application/json' } })
    .catch(enhanceError('Unable to exchange code for access token'))
  const accessToken = response.data.access_token
  console.log(response.data)
  return { accessToken }
}

export async function getGitHubProfile(accessToken: string) {
  const url = `https://api.github.com/user`
  const response = await axios
    .get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    .catch(enhanceError('Unable to get GitHub profile'))
  return response.data
}
