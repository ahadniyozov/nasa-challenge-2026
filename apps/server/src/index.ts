// Multiplayer rooms + leaderboard. The server is authoritative: it re-runs the same engine
// as the client, so nobody can fake a score. Single-player works without this server at all.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { Server } from 'socket.io';
import { computeBudgets, reviewDesign, scoreMission, simulateMission, STARTER_DESIGNS, type MissionDesign } from '@mission/engine';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? './data';
const BOARD_FILE = `${DATA_DIR}/leaderboard.json`;
const ROLES = ['director', 'engineer', 'science', 'ops'] as const;
type Role = (typeof ROLES)[number];

interface Entry { team: string; scenarioId: string; score: number; grade: string; seed: number; design: MissionDesign; at: string }
interface Room {
  code: string;
  design: MissionDesign;
  players: Map<string, { name: string; role: Role | null }>;
  votes: Partial<Record<Role, boolean>>;
}

mkdirSync(DATA_DIR, { recursive: true });
let board: Entry[] = existsSync(BOARD_FILE) ? JSON.parse(readFileSync(BOARD_FILE, 'utf8')) : [];
const saveBoard = () => writeFileSync(BOARD_FILE, JSON.stringify(board.slice(0, 500)));

const rooms = new Map<string, Room>();
const newCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

const http = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url?.startsWith('/api/health')) return void res.end('ok');
  if (req.url?.startsWith('/api/leaderboard')) {
    const scenario = new URL(req.url, 'http://x').searchParams.get('scenario');
    const rows = board.filter((e) => !scenario || e.scenarioId === scenario).sort((a, b) => b.score - a.score).slice(0, 20);
    res.setHeader('Content-Type', 'application/json');
    return void res.end(JSON.stringify(rows.map(({ design: _d, ...r }) => r)));
  }
  res.statusCode = 404;
  res.end();
});

const io = new Server(http, { path: '/socket.io', cors: { origin: '*' } });

io.on('connection', (socket) => {
  let room: Room | null = null;
  const broadcast = () => {
    if (!room) return;
    io.to(room.code).emit('room:state', {
      code: room.code,
      design: room.design,
      votes: room.votes,
      players: [...room.players.entries()].map(([id, p]) => ({ id, ...p })),
    });
  };

  socket.on('room:create', ({ name, scenarioId }: { name: string; scenarioId: string }, ack?: (code: string) => void) => {
    const code = newCode();
    room = { code, design: structuredClone(STARTER_DESIGNS[scenarioId] ?? STARTER_DESIGNS['first-cubesat']), players: new Map(), votes: {} };
    rooms.set(code, room);
    room.players.set(socket.id, { name: String(name).slice(0, 24), role: 'director' });
    socket.join(code);
    ack?.(code);
    broadcast();
  });

  socket.on('room:join', ({ code, name }: { code: string; name: string }, ack?: (ok: boolean) => void) => {
    const r = rooms.get(String(code).toUpperCase());
    if (!r || r.players.size >= 4) return ack?.(false);
    room = r;
    const taken = new Set([...r.players.values()].map((p) => p.role));
    room.players.set(socket.id, { name: String(name).slice(0, 24), role: ROLES.find((x) => !taken.has(x)) ?? null });
    socket.join(r.code);
    ack?.(true);
    broadcast();
  });

  // Any change to the design resets the Go/No-Go poll, like a real design change would.
  socket.on('design:update', (patch: Partial<MissionDesign>) => {
    if (!room) return;
    const next = { ...room.design, ...patch, scenarioId: room.design.scenarioId };
    try {
      computeBudgets(next); // reject unknown ids
      room.design = next;
      room.votes = {};
      broadcast();
    } catch {
      socket.emit('error:msg', 'Invalid design change');
    }
  });

  socket.on('poll:vote', (go: boolean) => {
    if (!room) return;
    const role = room.players.get(socket.id)?.role;
    if (!role) return;
    room.votes[role] = !!go;
    broadcast();
    const allGo = ROLES.every((r) => room!.votes[r] === true || ![...room!.players.values()].some((p) => p.role === r));
    if (allGo) {
      const b = computeBudgets(room.design);
      if (reviewDesign(b, room.design.reservePct).some((i) => i.severity === 'error')) return socket.emit('error:msg', 'Design has errors');
      const seed = Math.floor(Math.random() * 1e9);
      const sim = simulateMission(room.design, seed, b);
      io.to(room.code).emit('mission:launch', { seed, sim, score: scoreMission(b, sim) });
    }
  });

  // Leaderboard: the client sends design + seed; the server recomputes the score itself.
  socket.on('score:submit', ({ team, design, seed }: { team: string; design: MissionDesign; seed: number }) => {
    try {
      const b = computeBudgets(design);
      if (reviewDesign(b, design.reservePct).some((i) => i.severity === 'error')) return;
      const s = scoreMission(b, simulateMission(design, seed, b));
      board.push({ team: String(team).slice(0, 32), scenarioId: design.scenarioId, score: s.total, grade: s.grade, seed, design, at: new Date().toISOString() });
      board.sort((a, b) => b.score - a.score);
      saveBoard();
    } catch {
      /* ignore malformed submissions */
    }
  });

  socket.on('disconnect', () => {
    if (!room) return;
    room.players.delete(socket.id);
    if (room.players.size === 0) rooms.delete(room.code);
    else broadcast();
  });
});

http.listen(PORT, () => console.log(`mission server on :${PORT}`));
