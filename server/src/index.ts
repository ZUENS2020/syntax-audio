import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory workspace state
let workspaceState = {
  playlist: [] as string[],
  currentTrack: null as string | null,
  isPlaying: false,
  timestamp: 0,
};

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// API routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const songName = req.file.originalname;
  if (!workspaceState.playlist.includes(songName)) {
    workspaceState.playlist.push(songName);
    io.emit('playlist-update', workspaceState.playlist);
  }
  res.status(200).send('File uploaded.');
});

app.get('/api/songs', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading songs directory.');
    }
    workspaceState.playlist = files;
    res.json(files);
  });
});

app.get('/api/songs/:songName', (req, res) => {
  const songName = req.params.songName;
  const filePath = path.join(UPLOADS_DIR, songName);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Song not found.');
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('a user connected');

  // Send initial state to the new client
  socket.emit('workspace-update', workspaceState);

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('player-control', (action) => {
    switch (action.type) {
      case 'PLAY':
        workspaceState.isPlaying = true;
        workspaceState.currentTrack = action.payload.track;
        workspaceState.timestamp = 0;
        break;
      case 'PAUSE':
        workspaceState.isPlaying = false;
        workspaceState.timestamp = action.payload.timestamp;
        break;
      case 'SELECT_TRACK':
        workspaceState.currentTrack = action.payload.track;
        workspaceState.timestamp = 0;
        workspaceState.isPlaying = true;
        break;
    }
    // Broadcast the updated state to all clients
    io.emit('workspace-update', workspaceState);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
