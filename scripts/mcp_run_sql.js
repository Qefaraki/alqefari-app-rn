#!/usr/bin/env node
const { spawn } = require('child_process');

const sql = process.argv.slice(2).join(' ').trim();
if (!sql) {
  console.error('Usage: node scripts/mcp_run_sql.js <SQL>');
  process.exit(1);
}

const serverArgs = [
  '-y',
  '@supabase/mcp-server-supabase@latest',
  '--read-only',
  '--project-ref=ezkioroyhzpavmbfavyn'
];

const child = spawn('npx', serverArgs, {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN || 'sbp_9f9dee2904ef57405307cb150fad5ddee476cb7e'
  }
});

let buffer = '';
let nextId = 1;
const pending = new Map();

function sendRaw(json) {
  child.stdin.write(JSON.stringify(json) + '\n', 'utf8');
}

function sendRequest(method, params = {}) {
  const id = nextId++;
  const payload = { jsonrpc: '2.0', id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    sendRaw(payload);
  });
}

function sendResponse(id, result) {
  sendRaw({ jsonrpc: '2.0', id, result });
}

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch (err) {
      console.error('Failed to parse message', line);
      continue;
    }
    handleMessage(message);
  }
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`MCP server exited with code ${code}`);
    process.exit(code);
  }
});

child.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

function handleMessage(message) {
  if (message.id !== undefined) {
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      if (message.error) {
        entry.reject(message.error);
      } else {
        entry.resolve(message.result);
      }
      return;
    }
  }

  if (message.method) {
    switch (message.method) {
      case 'notifications/initialized':
        break;
      case 'notifications/log':
        if (message.params?.message) {
          console.error('[MCP]', message.params.level || 'info', message.params.message);
        }
        break;
      case 'pings/ping':
        if (message.id !== undefined) {
          sendResponse(message.id, { ok: true });
        }
        break;
      default:
        if (message.id !== undefined) {
          sendRaw({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not handled' } });
        }
    }
  }
}

function normalizeText(raw) {
  let text = raw;
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      text = JSON.parse(text);
    } catch (err) {
      // ignore
    }
  }
  return text;
}

function extractData(contentBlocks = []) {
  for (const block of contentBlocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      const text = normalizeText(block.text);
      const match = text.match(/\n<untrusted-data[^>]*>\s*\n([\s\S]*?)\n<\/untrusted-data[^>]*>/);
      if (match) {
        const payload = match[1].trim();
        try {
          return JSON.parse(payload);
        } catch (err) {
          console.error('Failed to parse JSON payload:', err.message);
          console.error(payload);
          return null;
        }
      }
      return text;
    }
    if (block.type === 'application/json') {
      return block.data;
    }
  }
  return null;
}

async function main() {
  try {
    await sendRequest('initialize', {
      protocolVersion: '2025-06-18',
      clientInfo: { name: 'codex-cli', version: '1.0.0' },
      capabilities: {}
    });
    const result = await sendRequest('tools/call', {
      name: 'execute_sql',
      arguments: { query: sql }
    });
    if (result?.isError) {
      console.error('Error:', JSON.stringify(result, null, 2));
    } else if (result?.content) {
      const data = extractData(result.content);
      if (data !== null) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    try {
      await sendRequest('shutdown');
    } catch (e) {}
    child.stdin.end();
  }
}

main();
