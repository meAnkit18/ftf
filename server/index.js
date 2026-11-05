import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { Server } from "socket.io";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || "*", credentials: true }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "ftf-server", time: new Date().toISOString() }));
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_URL?.split(",") || "*", methods: ["GET", "POST"] } });
const rooms = new Map();
const queue = [];

const code = () => randomBytes(3).toString("hex").toUpperCase();
const snapshot = room => ({ code: room.code, players: [...room.players.values()].map(p => ({ id: p.id, name: p.name })) });
const emitRoom = room => io.to(room.code).emit("room:state", snapshot(room));
const cleanName = value => String(value || "Fighter").trim().slice(0, 18) || "Fighter";
const removeFromQueue = id => { const index = queue.findIndex(p => p.id === id); if (index >= 0) queue.splice(index, 1); };

io.on("connection", socket => {
  socket.on("room:create", ({ name } = {}) => {
    let roomCode; do { roomCode = code(); } while (rooms.has(roomCode));
    const room = { code: roomCode, players: new Map([[socket.id, { id: socket.id, name: cleanName(name) }]]) };
    rooms.set(roomCode, room); socket.data.roomCode = roomCode; socket.join(roomCode);
    socket.emit("room:created", snapshot(room));
  });

  socket.on("room:join", ({ code: requested, name } = {}) => {
    const room = rooms.get(String(requested || "").toUpperCase());
    if (!room) return socket.emit("room:error", "That room code does not exist.");
    if (room.players.size >= 2) return socket.emit("room:error", "This arena is already full.");
    if (room.players.has(socket.id)) return;
    room.players.set(socket.id, { id: socket.id, name: cleanName(name) });
    socket.data.roomCode = room.code; socket.join(room.code);
    socket.emit("room:joined", snapshot(room)); emitRoom(room);
  });

  socket.on("matchmaking:join", ({ name } = {}) => {
    removeFromQueue(socket.id);
    const opponentIndex = queue.findIndex(p => p.id !== socket.id);
    if (opponentIndex < 0) {
      queue.push({ id: socket.id, name: cleanName(name) });
      socket.emit("matchmaking:waiting");
      return;
    }
    const opponent = queue.splice(opponentIndex, 1)[0];
    let roomCode; do { roomCode = code(); } while (rooms.has(roomCode));
    const room = { code: roomCode, players: new Map([[opponent.id, opponent], [socket.id, { id: socket.id, name: cleanName(name) }]]) };
    rooms.set(roomCode, room);
    for (const id of [opponent.id, socket.id]) {
      const peer = io.sockets.sockets.get(id);
      if (peer) { peer.data.roomCode = roomCode; peer.join(roomCode); peer.emit("matchmaking:found", snapshot(room)); }
    }
  });

  socket.on("room:leave", () => leaveRoom(socket));
  socket.on("disconnect", () => { removeFromQueue(socket.id); leaveRoom(socket); });
});

function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  socket.leave(roomCode); delete socket.data.roomCode;
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) rooms.delete(roomCode);
  else emitRoom(room);
}

const port = Number(process.env.PORT || 4000);
httpServer.listen(port, "0.0.0.0", () => console.log(`FTF server listening on ${port}`));
