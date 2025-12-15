import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../dist')));

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = 3000;

// Ensure uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// Data models (in-memory)
interface SharedTrack {
  id: string;
  filename: string;
  originalName: string;
  uploadedBy: string;
  workspaceId: string;
  uploadedAt: string;
}

interface SharedWorkspace {
  id: string;
  name: string;
  playlist: SharedTrack[];
  createdBy: string;
  createdAt: string;
}

const sharedWorkspaces: SharedWorkspace[] = [];
const sharedSongs: SharedTrack[] = [];

// Default workspace
if (sharedWorkspaces.length === 0) {
  sharedWorkspaces.push({ id: 'default', name: '默认工作区', playlist: [], createdBy: 'system', createdAt: new Date().toISOString() });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.emit('workspaces', sharedWorkspaces);
  socket.emit('songs', sharedSongs);

  socket.on('create-workspace', (data: { name: string; createdBy?: string }) => {
    const id = `${Date.now()}`;
    const ws: SharedWorkspace = { id, name: data.name, playlist: [], createdBy: data.createdBy || 'anonymous', createdAt: new Date().toISOString() };
    sharedWorkspaces.push(ws);
    io.emit('workspace-created', ws);
  });

  socket.on('update-workspace', (data: { id: string; name?: string; playlist?: SharedTrack[] }) => {
    const ws = sharedWorkspaces.find(w => w.id === data.id);
    if (!ws) return;
    if (data.name) ws.name = data.name;
    if (data.playlist) ws.playlist = data.playlist;
    io.emit('workspace-updated', ws);
  });

  socket.on('delete-workspace', (id: string) => {
    if (sharedWorkspaces.length <= 1) return; // keep at least one
    const idx = sharedWorkspaces.findIndex(w => w.id === id);
    if (idx !== -1) {
      sharedWorkspaces.splice(idx, 1);
      // remove songs in that workspace
      for (let i = sharedSongs.length - 1; i >= 0; i--) {
        if (sharedSongs[i].workspaceId === id) sharedSongs.splice(i, 1);
      }
      io.emit('workspace-deleted', { id });
      io.emit('songs', sharedSongs);
    }
  });
});

// Upload
app.post('/upload', upload.single('song'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件上传' });
  const workspaceId = req.body.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: '缺少 workspaceId' });
  const song: SharedTrack = {
    id: `${Date.now()}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadedBy: req.body.uploadedBy || 'anonymous',
    workspaceId,
    uploadedAt: new Date().toISOString()
  };
  sharedSongs.push(song);
  const ws = sharedWorkspaces.find(w => w.id === workspaceId);
  if (ws) ws.playlist.push(song);
  io.emit('song-uploaded', song);
  io.emit('workspace-updated', ws);
  res.json({ message: '上传成功', song });
});

app.get('/workspaces', (_req, res) => res.json(sharedWorkspaces));
app.get('/songs', (_req, res) => res.json(sharedSongs));
app.get('/workspaces/:id/songs', (req, res) => {
  const workspaceId = req.params.id;
  res.json(sharedSongs.filter(s => s.workspaceId === workspaceId));
});

// stream with range support
app.get('/stream/:songId', (req, res) => {
  const song = sharedSongs.find(s => s.id === req.params.songId);
  if (!song) return res.status(404).json({ error: '歌曲未找到' });
  const filePath = path.join(uploadsDir, song.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': 'audio/mpeg' });
    stream.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'audio/mpeg' });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.use('/uploads', express.static(uploadsDir));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../dist')));

// error
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('server error', err);
  res.status(500).json({ error: 'internal' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log('Server address:', server.address());
}).on('error', (err) => { console.error('server listen error', err); process.exit(1); });

console.log('Server setup complete');

// Keep alive
setInterval(() => console.log('Server is running...'), 10000);