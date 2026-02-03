#!/usr/bin/env node

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.join(__dirname, '..', 'agent-icons')

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath)
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          fs.unlinkSync(filepath)
          downloadFile(res.headers.location, filepath).then(resolve).catch(reject)
          return
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(filepath, () => {})
        reject(err)
      })
  })
}

async function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log('Fetching agent data from Valorant API...')
  const response = await fetchJSON('https://valorant-api.com/v1/agents?isPlayableCharacter=true')

  if (response.status !== 200) {
    console.error('Failed to fetch agent data')
    process.exit(1)
  }

  const agents = response.data
  console.log(`Found ${agents.length} agents\n`)

  for (const agent of agents) {
    const name = agent.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const iconUrl = agent.displayIcon
    const filepath = path.join(OUTPUT_DIR, `${name}.png`)

    console.log(`Downloading ${agent.displayName}...`)
    try {
      await downloadFile(iconUrl, filepath)
      console.log(`  ✓ Saved to ${filepath}`)
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
