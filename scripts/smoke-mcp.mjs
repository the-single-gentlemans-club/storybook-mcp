#!/usr/bin/env node
/**
 * End-to-end smoke: spawn the built CLI with --skip-init --no-watch --no-preflight, connect via MCP
 * stdio, list tools, call check_health and list_components.
 *
 * Prerequisites: `npm run build` (dist/cli.js must exist).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const cliJs = path.join(rootDir, 'dist', 'cli.js')
const fixtureDir = path.join(rootDir, 'scripts', 'fixtures', 'smoke-project')

if (!fs.existsSync(cliJs)) {
  console.error(`[smoke] Missing ${cliJs} — run: npm run build`)
  process.exit(1)
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [cliJs, '--skip-init', '--no-watch', '--no-preflight'],
  cwd: fixtureDir,
  stderr: 'inherit'
})

const client = new Client(
  { name: 'storybook-mcp-smoke', version: '0.0.0' },
  { capabilities: {} }
)

try {
  await client.connect(transport)

  const { tools } = await client.listTools()
  if (!tools?.length) {
    throw new Error('listTools returned no tools')
  }

  const names = new Set(tools.map(t => t.name))
  for (const req of ['list_components', 'check_health', 'generate_story']) {
    if (!names.has(req)) {
      throw new Error(`Missing tool: ${req}`)
    }
  }

  const health = await client.callTool({
    name: 'check_health',
    arguments: {}
  })
  const healthText = health.content?.find(c => c.type === 'text')?.text
  if (!healthText) {
    throw new Error('check_health: no text content')
  }
  JSON.parse(healthText)

  const listed = await client.callTool({
    name: 'list_components',
    arguments: {}
  })
  const listText = listed.content?.find(c => c.type === 'text')?.text
  if (!listText) {
    throw new Error('list_components: no text content')
  }
  const listParsed = JSON.parse(listText)
  if (typeof listParsed.total !== 'number') {
    throw new Error('list_components: expected numeric total')
  }

  console.error(
    `[smoke] ok — ${tools.length} tools; check_health + list_components JSON round-trip`
  )
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[smoke] FAILED: ${msg}`)
  process.exitCode = 1
} finally {
  try {
    await client.close()
  } catch {
    // ignore shutdown errors
  }
}

process.exit(process.exitCode ?? 0)
