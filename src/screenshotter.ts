import { encrypted } from './encrypted'
import { BotContext } from './types'

const url = encrypted`qV3h4KkfhAU6wPzpKyvuNyHx9NsMhL56.U1zwqfzYX7rDaq01CiCjQj76i07B5dCO6YUiwB+Bm6RfEsgOQgMnYdfLOkKdtrIzg6CRovyXfHxF3QZsfWbpCQ==`

export const getTailwindCssHtml = (body: string) => {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@100;200;300;400;500;600;700;800;900&family=Noto+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap");

      body {
        font-family: Noto Sans, Noto Sans Thai, ui-sans-serif, system-ui,
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji",
          "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      }
    </style>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <!-- prettier-ignore -->
  <body>
${body}    
  </body>
</html>`
}

export const getRenderingCode = (html: string) => {
  const f = async ([html]: [string]) => {
    await page.setViewport({ width: 540, height: 720, deviceScaleFactor: 1 })
    await page.goto('data:text/html,' + encodeURIComponent(html), {
      waitUntil: 'networkidle0',
      timeout: 10000,
    })
    await page.waitForTimeout(300)
  }
  const args = [html]
  return `(${f.toString()})(${JSON.stringify(args)})`
}

declare var page: any
export async function screenshot(context: BotContext, code: string) {
  const client = await context.unscopedGoogleAuth.getIdTokenClient(url)
  try {
    const res = await client.request({
      url,
      method: 'POST',
      data: { code },
      responseType: 'arraybuffer',
    })
    return Buffer.from(res.data as ArrayBuffer)
  } catch (error) {
    const data = (error as any)?.response?.data
    if (data) {
      throw new Error(
        'Screenshot failed: ' +
          String(error) +
          '\nData: ' +
          Buffer.from(data).toString(),
      )
    }
    throw error
  }
}
