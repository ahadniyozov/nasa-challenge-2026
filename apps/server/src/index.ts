// Crew mode server: up to 4 players fly one mission together as a mission-control team.
// Each role owns some of the satellite's parts; money, mass and power are shared, so the team has to agree.
// The launch needs a GO from every role (the real NASA "GO / NO-GO poll").
// In flight the flight director's browser runs the simulation and streams snapshots; the others work
// from their consoles (safe mode, callouts). Single-player does not need this server at all.
import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { MISSIONS } from '../../web/src/game2d/missions';
import type { Build, SlotId } from '../../web/src/game2d/config';
import { OWNER, ROLES, type Role } from '../../web/src/crew/roles';

const PORT = Number(process.env.PORT ?? 8787);

import type { Phase } from '../../web/src/crew/roles';
interface Player { id: string; name: string; roles: Role[]; online: boolean }
interface Room {
  code: string;
  phase: Phase;
  missionId: string;
  build: Build;
  players: Player[];
  votes: Partial<Record<Role, boolean>>;
  /** who said NO-GO in the last poll, and the last change per slot (for the report) */
  noGo: Role[];
  seed: number;
  run: number;
  stats: unknown;
  test: boolean;
  touched: number;
}

const rooms = new Map<string, Room>();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => {
  for (;;) {
    const c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    if (!rooms.has(c)) return c;
  }
};
const clean = (s: unknown, max = 24) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const missionOf = (id: string) => MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];

function publicState(r: Room) {
  return {
    code: r.code, phase: r.phase, missionId: r.missionId, build: r.build, votes: r.votes, noGo: r.noGo,
    seed: r.seed, run: r.run, stats: r.stats, test: r.test,
    players: r.players.map(({ id, name, roles, online }) => ({ id, name, roles, online })),
  };
}

const http = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url?.startsWith('/api/health')) return void res.end('ok');
  if (req.url?.startsWith('/api/rooms')) return void res.end(JSON.stringify({ rooms: rooms.size }));
  res.statusCode = 404;
  res.end();
});
const io = new Server(http, { path: '/socket.io', cors: { origin: '*' }, maxHttpBufferSize: 64 * 1024 });

const send = (r: Room) => { r.touched = Date.now(); io.to(r.code).emit('crew:state', publicState(r)); };

io.on('connection', (socket: Socket) => {
  let room: Room | null = null;
  // a reconnecting player keeps their seat: the client sends the same id it got the first time
  const pid = clean(socket.handshake.auth?.pid, 40) || socket.id;
  const me = () => room?.players.find((p) => p.id === pid);
  const has = (role: Role) => !!me()?.roles.includes(role);

  const enter = (r: Room, name: string) => {
    room = r;
    socket.join(r.code);
    const old = r.players.find((p) => p.id === pid);
    if (old) { old.online = true; old.name = name || old.name; }
    else r.players.push({ id: pid, name: name || `Player ${r.players.length + 1}`, roles: [], online: true });
    send(r);
  };

  socket.on('crew:create', ({ name, missionId }: { name: string; missionId: string }, ack?: (code: string) => void) => {
    const m = missionOf(clean(missionId));
    const r: Room = {
      code: newCode(), phase: 'lobby', missionId: m.id, build: { ...m.start }, players: [], votes: {}, noGo: [],
      seed: 1, run: 0, stats: null, test: false, touched: Date.now(),
    };
    rooms.set(r.code, r);
    enter(r, clean(name));
    // the creator starts as flight director; roles can be swapped in the lobby
    me()!.roles = ['director'];
    send(r);
    ack?.(r.code);
  });

  socket.on('crew:join', ({ code, name }: { code: string; name: string }, ack?: (err: string | null) => void) => {
    const r = rooms.get(clean(code, 8).toUpperCase());
    if (!r) return ack?.('No crew with this code');
    if (!r.players.some((p) => p.id === pid) && r.players.filter((p) => p.online).length >= 4) return ack?.('This crew is full (4 players)');
    enter(r, clean(name));
    ack?.(null);
  });

  /** take or give back a role (a player may hold several when the crew is small) */
  socket.on('crew:role', ({ role, take }: { role: Role; take: boolean }) => {
    const r = room, p = me();
    if (!r || !p || !ROLES.includes(role) || (r.phase !== 'lobby' && r.phase !== 'build')) return;
    const holder = r.players.find((x) => x.roles.includes(role));
    if (take && (!holder || !holder.online)) {
      if (holder) holder.roles = holder.roles.filter((x) => x !== role);
      p.roles = [...new Set([...p.roles, role])];
    } else if (!take) p.roles = p.roles.filter((x) => x !== role);
    send(r);
  });

  socket.on('crew:mission', ({ missionId }: { missionId: string }) => {
    const r = room;
    if (!r || !has('director') || r.phase !== 'lobby') return;
    const m = missionOf(clean(missionId));
    r.missionId = m.id; r.build = { ...m.start };
    send(r);
  });

  socket.on('crew:start', () => {
    const r = room;
    if (!r || !has('director') || r.phase !== 'lobby') return;
    if (!ROLES.every((role) => r.players.some((p) => p.roles.includes(role)))) return;
    r.phase = 'build'; r.votes = {}; r.noGo = [];
    send(r);
  });

  /** change a part: only the role that owns it, only parts this mission lets the team change */
  socket.on('crew:slot', ({ slot, option }: { slot: SlotId; option: string }) => {
    const r = room;
    if (!r || (r.phase !== 'build' && r.phase !== 'poll')) return;
    const m = missionOf(r.missionId);
    if (!m.slots.includes(slot) || !has(OWNER[slot])) return;
    r.build = { ...r.build, [slot]: clean(option, 32) } as Build;
    // any change during a poll cancels it: everyone must look at the new design
    if (r.phase === 'poll') { r.phase = 'build'; r.votes = {}; }
    send(r);
  });

  socket.on('crew:poll', () => {
    const r = room;
    if (!r || !has('director') || r.phase !== 'build') return;
    r.phase = 'poll'; r.votes = {}; r.noGo = [];
    send(r);
  });

  socket.on('crew:vote', ({ role, go }: { role: Role; go: boolean }) => {
    const r = room;
    if (!r || r.phase !== 'poll' || !has(role)) return;
    r.votes[role] = !!go;
    if (!go) { r.phase = 'build'; r.noGo = [role]; r.votes = {}; }
    else if (ROLES.every((x) => r.votes[x])) {
      r.phase = 'launch'; r.seed = Math.floor(Math.random() * 2 ** 31); r.run++; r.stats = null; r.test = false;
    }
    send(r);
  });

  // ---- in flight
  socket.on('crew:flying', () => { const r = room; if (r && has('director') && r.phase === 'launch') { r.phase = 'flight'; send(r); } });
  socket.on('crew:tick', (snap: unknown) => { if (room && has('director') && room.phase === 'flight') socket.to(room.code).volatile.emit('crew:tick', snap); });
  socket.on('crew:safe', ({ on }: { on: boolean }) => { if (room && has('engineer')) io.to(room.code).emit('crew:safe', { on: !!on }); });
  socket.on('crew:call', ({ key }: { key: string }) => {
    const p = me();
    if (room && p) io.to(room.code).emit('crew:call', { key: clean(key, 40), from: p.name, roles: p.roles, at: Date.now() });
  });
  socket.on('crew:end', ({ stats }: { stats: unknown }) => {
    const r = room;
    if (!r || !has('director') || (r.phase !== 'flight' && r.phase !== 'launch')) return;
    r.phase = 'report'; r.stats = stats;
    send(r);
  });

  /** after the report: back to the drawing board (everyone), or the next mission (director) */
  socket.on('crew:redesign', () => { const r = room; if (r && r.phase === 'report') { r.phase = 'build'; r.votes = {}; r.noGo = []; send(r); } });
  socket.on('crew:again', () => {
    const r = room;
    if (r && has('director') && r.phase === 'report') { r.phase = 'launch'; r.seed = Math.floor(Math.random() * 2 ** 31); r.run++; r.stats = null; send(r); }
  });
  socket.on('crew:lobby', () => { const r = room; if (r && has('director') && r.phase === 'report') { r.phase = 'lobby'; r.votes = {}; send(r); } });

  socket.on('disconnect', () => {
    const r = room, p = me();
    if (!r || !p) return;
    p.online = false;
    send(r);
  });
});

// forget rooms nobody touched for 6 hours
setInterval(() => {
  const old = Date.now() - 6 * 3600_000;
  for (const [code, r] of rooms) if (r.touched < old && r.players.every((p) => !p.online)) rooms.delete(code);
}, 600_000).unref();

http.listen(PORT, () => console.log(`GO / NO-GO crew server on :${PORT}`));
