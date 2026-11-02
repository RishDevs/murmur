import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { initialRound, reduceRound, snapshot } from '../src/round.js';
import { Auth } from './auth.js';
import { EventSub } from './eventsub.js';

const demo = process.argv.includes('--demo');
const publicDirectory = resolve('public');
const port = Number(process.env.PORT) || 4747;
const clients = new Set();
let round = initialRound();
let status = demo ? 'SIMULATED' : 'OFFLINE';
let loginInfo = null;
let loginError = '';
let connector;
let loginBusy = false;

async function loadEnvironment() {
  try {
    const lines = (await readFile('.env', 'utf8')).split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    // The environment file is optional.
  }
}

await loadEnvironment();
const serverPort = Number(process.env.PORT) || port;

function currentView() {
  return { ...snapshot(round), status, demo, channel: demo ? null : auth.user?.login || null, login: loginInfo, loginError };
}

function broadcast(event = null) {
  const data = JSON.stringify({ state: currentView(), event });
  for (const response of clients) response.write(`data: ${data}\n\n`);
}

function applyAction(action) {
  const result = reduceRound(round, action);
  round = result.state;
  broadcast(result.event);
}

const auth = new Auth(process.env.MURMUR_TWITCH_CLIENT_ID, info => {
  loginInfo = info;
  broadcast();
});

function connectTwitch() {
  connector?.stop();
  connector = new EventSub(auth, applyAction, nextStatus => {
    status = nextStatus;
    broadcast();
  });
  connector.start();
}

async function login() {
  if (loginBusy || demo) return;
  loginBusy = true;
  loginError = '';
  try {
    await auth.login();
    connectTwitch();
  } catch (error) {
    loginInfo = null;
    loginError = error.message;
    status = 'OFFLINE';
    broadcast();
  } finally {
    loginBusy = false;
  }
}

function openEventStream(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  clients.add(response);
  response.write(`data: ${JSON.stringify({ state: currentView(), event: null })}\n\n`);
  request.on('close', () => clients.delete(response));
}

async function handleApi(request, response, pathname) {
  if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.writeHead(403).end();
    return;
  }
  let rawBody = '';
  try {
    for await (const chunk of request) {
      rawBody += chunk;
      if (rawBody.length > 4096) throw new Error('Request too large');
    }
  } catch {
    response.writeHead(413).end();
    return;
  }
  let body = {};
  try {
    if (rawBody) body = JSON.parse(rawBody);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const action = pathname.slice(5);
  if (action === 'login') {
    void login();
  } else if (['start', 'pause', 'clear', 'reset', 'hide'].includes(action)) {
    applyAction({ type: action, question: body.question, answer: body.answer });
  } else {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
}

async function serveStatic(response, pathname) {
  const file = pathname === '/' || pathname === '/control'
    ? 'control.html'
    : pathname === '/overlay' ? 'overlay.html' : pathname.slice(1);
  const path = resolve(publicDirectory, file);
  if (!path.startsWith(`${publicDirectory}/`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(path);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
    };
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }).end(content);
  } catch {
    response.writeHead(404).end();
  }
}

function startDemo() {
  const viewers = [
    { id: 'sim-a', name: 'Avery', answer: 'sir neighs' },
    { id: 'sim-b', name: 'Blair', answer: 'sir neighs' },
    { id: 'sim-c', name: 'Casey', answer: 'biscuit' },
  ];
  let step = 0;
  setInterval(() => {
    if (round.phase !== 'open') return;
    const viewer = viewers[step % viewers.length];
    const migrated = step >= 3 && Math.floor((step - 3) / 3) % 2 === 0;
    const answer = migrated && viewer.id === 'sim-a' ? 'biscuit' : viewer.answer;
    applyAction({
      type: 'vote', userId: viewer.id, name: viewer.name, text: answer,
      messageId: `sim-${step}`, at: Date.now(),
    });
    step++;
  }, 2200);
}

if (!demo && auth.clientId) {
  auth.load().then(loaded => {
    if (loaded) connectTwitch();
  }).catch(() => {});
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method === 'GET' && url.pathname === '/events') {
    openEventStream(request, response);
  } else if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
    await handleApi(request, response, url.pathname);
  } else if (request.method === 'GET') {
    await serveStatic(response, url.pathname);
  } else {
    response.writeHead(405).end();
  }
});

server.listen(serverPort, '127.0.0.1', () => {
  console.log(`Murmur ${demo ? 'SIMULATED' : 'ready'}: http://localhost:${serverPort}/control`);
});
if (demo) startDemo();
