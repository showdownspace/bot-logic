import { watch } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import fs from 'fs'
import { createHash } from 'crypto'
import axios from 'axios'
import deployToken from './deploy-token.mjs'

const sentHash = new Set()
const compact = true
const watcher = watch({
  input: './src/index.ts',
  external: ['discord.js'],
  plugins: [esbuild({ minify: compact }), nodeResolve(), commonjs(), json()],
  output: {
    dir: 'dist',
    format: 'cjs',
    chunkFileNames: '[name].js',
    sourcemap: 'inline',
    compact: compact,
    manualChunks(id) {
      if (id.includes('node_modules')) {
        return 'vendor'
      }
    },
  },
})

let nextDeployment
let deploying = false

watcher.on('event', (event) => {
  // event.code can be one of:
  //   START        — the watcher is (re)starting
  //   BUNDLE_START — building an individual bundle
  //                  * event.input will be the input options object if present
  //                  * event.output contains an array of the "file" or
  //                    "dir" option values of the generated outputs
  //   BUNDLE_END   — finished building a bundle
  //                  * event.input will be the input options object if present
  //                  * event.output contains an array of the "file" or
  //                    "dir" option values of the generated outputs
  //                  * event.duration is the build duration in milliseconds
  //                  * event.result contains the bundle object that can be
  //                    used to generate additional outputs by calling
  //                    bundle.generate or bundle.write. This is especially
  //                    important when the watch.skipWrite option is used.
  //                  You should call "event.result.close()" once you are done
  //                  generating outputs, or if you do not generate outputs.
  //                  This will allow plugins to clean up resources via the
  //                  "closeBundle" hook.
  //   END          — finished building all bundles
  //   ERROR        — encountered an error while bundling
  //                  * event.error contains the error that was thrown
  //                  * event.result is null for build errors and contains the
  //                    bundle object for output generation errors. As with
  //                    "BUNDLE_END", you should call "event.result.close()" if
  //                    present once you are done.
  console.log(`[${new Date().toISOString()}] ${event.code}`)

  if ('result' in event && event.result) {
    const { result } = event
    if (event.code === 'BUNDLE_END') {
      const read = (filename) => {
        const data = fs.readFileSync('dist/' + filename)
        const hash = createHash('sha256').update(data).digest('hex')
        const kb = Math.round(data.length / 1024)
        console.log(' ->', filename, `[${kb} KB]`, hash)
        return { filename, data, hash }
      }
      deploy([read('index.js'), read('vendor.js')])
    }
    event.result.close()
  }
})

function deploy(files) {
  nextDeployment = files
  if (deploying) {
    return
  }
  deploying = true
  const loop = async () => {
    while (nextDeployment) {
      const promise = doDeploy(nextDeployment)
      nextDeployment = undefined
      try {
        await promise
      } catch (error) {
        console.error(error)
      }
    }
  }
  loop().finally(() => {
    deploying = false
  })
}

async function doDeploy(files) {
  console.log(
    `[${new Date().toISOString()}] Deploying ${files.length} files...`,
  )
  const data = {
    files: files.map((file) => {
      return {
        filename: file.filename,
        data: sentHash.has(file.hash) ? undefined : file.data.toString(),
        hash: file.hash,
      }
    }),
    token: deployToken,
  }
  const response = await axios.post(
    'https://showdownspace-bot.wonderful.software/deploy',
    data,
    { validateStatus: () => true },
  )
  console.log(
    `[${new Date().toISOString()}] Deploy result: ${response.status} ${
      response.statusText
    }`,
  )
  if (response.status === 200) {
    for (const file of files) {
      sentHash.add(file.hash)
    }
  }
}

// const bundle = await rollup({
// })
// const { output } = await bundle.write({
// })
