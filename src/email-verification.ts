import axios from 'axios'
import { encrypted } from './encrypted'
import { enhanceError } from './enhance-error'

export async function sendEmailVerificationRequest(email: string) {
  await axios
    .post('https://showdownspace.jp.auth0.com/passwordless/start', {
      client_id: '72derkSAEStZjvJtb5nRhmVPPcXNCPw3',
      client_secret: encrypted`L8Onsmid+ctZiugYBzLfK2jIhEl5bF8B.ttcPSBd2KHpqdAB+rLIEJ2dkpNtEoAz4DfNChXuGk8y0/ULtJokWW654hrbgteiQqUgDfvXQA6c7UvPEaVG3nGRsZGzj0tExD50YubSOmGqqCQ==`,
      connection: 'email',
      email,
      send: 'code',
    })
    .catch(enhanceError('Unable to send email verification request'))
}

export async function verifyEmail(email: string, otp: string) {
  await axios
    .post('https://showdownspace.jp.auth0.com/oauth/token', {
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      client_id: '72derkSAEStZjvJtb5nRhmVPPcXNCPw3',
      client_secret: encrypted`L8Onsmid+ctZiugYBzLfK2jIhEl5bF8B.ttcPSBd2KHpqdAB+rLIEJ2dkpNtEoAz4DfNChXuGk8y0/ULtJokWW654hrbgteiQqUgDfvXQA6c7UvPEaVG3nGRsZGzj0tExD50YubSOmGqqCQ==`,
      username: email,
      realm: 'email',
      otp: otp,
      scope: 'openid profile email',
    })
    .catch(enhanceError('Unable to verify your email'))
  // If response is 200, then the email is verified.
}
