import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Swords, Zap, Users, Plus, DoorOpen, Copy, Check, Wifi, WifiOff, Trophy, Shield, Gamepad2 } from "lucide-react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const socket = io(SERVER_URL, { autoConnect: false, transports: ["websocket", "polling"] });

export default function App() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState(localStorage.getItem("ftf-name") || "Fighter");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [notice, setNotice] = useState("Connect to the arena to get started.");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    socket.connect();
    socket.on("connect", () => { setConnected(true); setNotice("Connected. Choose your next move."); });
    socket.on("disconnect", () => { setConnected(false); setNotice("Connection lost. Reconnecting…"); });
    socket.on("room:state", setRoom);
    socket.on("room:error", (message) => { setBusy(false); setNotice(message); });
    socket.on("room:created", (data) => { setRoom(data); setBusy(false); setNotice("Arena created. Share the code with your opponent."); });
    socket.on("room:joined", (data) => { setRoom(data); setBusy(false); setNotice("You made it in. Get ready."); });
    socket.on("matchmaking:waiting", () => { setBusy(false); setNotice("Searching for an opponent… You're in the queue."); });
    socket.on("matchmaking:found", (data) => { setRoom(data); setBusy(false); setNotice("Opponent found. The arena is yours."); });
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, []);

  const players = room?.players || [];
  const myId = socket.id;
  const updateName = (value) => { setName(value); localStorage.setItem("ftf-name", value); };
  const createRoom = () => { if (!connected) return setNotice("Wait for the server connection."); setBusy(true); socket.emit("room:create", { name }); };
  const joinRoom = () => { if (!roomCode.trim()) return setNotice("Enter a room code first."); setBusy(true); socket.emit("room:join", { code: roomCode.trim().toUpperCase(), name }); };
  const quickMatch = () => { if (!connected) return setNotice("Wait for the server connection."); setBusy(true); socket.emit("matchmaking:join", { name }); };
  const copyCode = async () => { if (!room?.code) return; await navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  const leaveRoom = () => { socket.emit("room:leave"); setRoom(null); setNotice("You left the arena."); };

  return <main className="shell">
    <nav className="nav"><a className="brand" href="#"><span className="brand-mark"><Swords size={19}/></span> FTF<span className="brand-dot">.</span></a><div className="nav-right"><span className={connected ? "status online" : "status"}><i/>{connected ? "SERVER ONLINE" : "CONNECTING"}</span><span className="version">BETA 0.1</span></div></nav>
    <section className="hero">
      <div className="eyebrow"><span className="eyebrow-line"/> THE ARENA IS OPEN <span className="eyebrow-line"/></div>
      <h1>FIGHT FOR<br/><em>YOUR</em> GLORY.</h1>
      <p className="subtitle">No excuses. No second chances. Just you, your rival, and the arena.</p>
      <div className="hero-actions"><button className="btn primary" onClick={quickMatch} disabled={!connected || busy}><Zap size={17} fill="currentColor"/>{busy ? "PLEASE WAIT…" : "QUICK MATCH"}</button><span className="action-note">FIND AN OPPONENT INSTANTLY</span></div>
    </section>
    <section className="content-grid">
      <div className="panel setup-panel">
        <div className="panel-heading"><div><span className="kicker">01 / PLAYER SETUP</span><h2>Enter your name</h2></div><div className="icon-box"><Shield size={20}/></div></div>
        <label className="field-label" htmlFor="fighter-name">FIGHTER TAG</label>
        <input id="fighter-name" maxLength={18} value={name} onChange={e => updateName(e.target.value)} placeholder="Your fighter name"/>
        <div className="divider"/>
        <div className="panel-heading compact"><div><span className="kicker">02 / CREATE A MATCH</span><h2>Build your arena</h2></div></div>
        <p className="muted">Create a private room and invite a friend with your unique code.</p>
        <button className="btn secondary full" onClick={createRoom} disabled={!connected || busy}><Plus size={17}/> CREATE PRIVATE ROOM</button>
        <div className="join-row"><input aria-label="Room code" maxLength={6} value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ENTER ROOM CODE"/><button className="btn join" onClick={joinRoom} disabled={!connected || busy}><DoorOpen size={16}/> JOIN</button></div>
      </div>
      <div className="panel arena-panel">
        <div className="panel-heading"><div><span className="kicker">LIVE / MATCH STATUS</span><h2>{room ? "Your arena" : "The battlefield"}</h2></div><div className="icon-box orange"><Gamepad2 size={20}/></div></div>
        {room ? <><div className="room-code"><span>ROOM CODE</span><strong>{room.code}</strong><button onClick={copyCode} aria-label="Copy room code">{copied ? <Check size={17}/> : <Copy size={17}/>}</button></div><div className="players">{[0,1].map(i => <div className="player-slot" key={i}><div className="player-avatar">{i === 0 ? "01" : "02"}</div><div><b>{players[i]?.name || "Waiting for fighter…"}</b><small>{players[i] ? (players[i].id === myId ? "YOU · READY" : "OPPONENT") : "OPEN SLOT"}</small></div><span className={players[i] ? "slot-dot filled" : "slot-dot"}/></div>)}</div><div className="room-footer"><span>{players.length}/2 FIGHTERS</span><button className="text-button" onClick={leaveRoom}>LEAVE ARENA <span>↗</span></button></div></> : <div className="empty-arena"><div className="arena-emblem"><Swords size={34}/></div><strong>NO ACTIVE MATCH</strong><p>Your next battle is one click away.</p><div className="arena-stats"><div><b>1v1</b><small>DUEL MODE</small></div><div><b>∞</b><small>REMATCHES</small></div><div><b>0</b><small>ACTIVE ROOMS</small></div></div></div>}
      </div>
    </section>
    <div className="notice"><span className="notice-icon">{connected ? <Wifi size={15}/> : <WifiOff size={15}/>}</span>{notice}</div>
    <footer><span>© 2026 FIGHTFORFIGHT</span><span><Trophy size={13}/> BUILT FOR COMPETITORS</span><span>PLAY FAIR. FIGHT HARD.</span></footer>
  </main>;
}
