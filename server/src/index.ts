import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());
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

interface Workspace {
  id: string;
  name: string;
  playlist: string[];
  currentTrack: string | null;
  isPlaying: boolean;
  timestamp: number;
}

// In-memory workspace management
let workspaces: Record<string, Workspace> = {};
let activeWorkspaceId: string | null = null;

const getActiveWorkspace = (): Workspace | null => {
  return activeWorkspaceId ? workspaces[activeWorkspaceId] : null;
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
  const activeWorkspace = getActiveWorkspace();
  if (activeWorkspace && !activeWorkspace.playlist.includes(songName)) {
    activeWorkspace.playlist.push(songName);
    io.emit('playlist-update', activeWorkspace.playlist);
  }
  res.status(200).send('File uploaded.');
});

app.get('/api/songs', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading songs directory.');
    }
    const activeWorkspace = getActiveWorkspace();
    if (activeWorkspace) {
      activeWorkspace.playlist = files;
      res.json(files);
    } else {
      res.json([]);
    }
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

app.delete('/api/songs', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading songs directory.');
    }
    for (const file of files) {
      fs.unlink(path.join(UPLOADS_DIR, file), err => {
        if (err) {
          console.error(`Error deleting file ${file}:`, err);
        }
      });
    }
    const activeWorkspace = getActiveWorkspace();
    if (activeWorkspace) {
      activeWorkspace.playlist = [];
      activeWorkspace.currentTrack = null;
      activeWorkspace.isPlaying = false;
      activeWorkspace.timestamp = 0;
      io.emit('workspace-update', activeWorkspace);
    }
    res.status(200).send('Playlist cleared.');
  });
});

// Workspace management endpoints
app.post('/api/workspaces', (req, res) => {
  const { name } = req.body;
  const id = uuidv4();
  const newWorkspace: Workspace = {
    id,
    name: name || `Workspace ${Object.keys(workspaces).length + 1}`,
    playlist: [],
    currentTrack: null,
    isPlaying: false,
    timestamp: 0,
  };
  workspaces[id] = newWorkspace;
  if (!activeWorkspaceId) {
    activeWorkspaceId = id;
  }
  res.status(201).json(newWorkspace);
});

app.delete('/api/workspaces/:id', (req, res) => {
  const { id } = req.params;
  delete workspaces[id];
  if (activeWorkspaceId === id) {
    activeWorkspaceId = Object.keys(workspaces)[0] || null;
  }
  res.status(204).send();
});

app.post('/api/workspaces/switch', (req, res) => {
  const { id } = req.body;
  if (workspaces[id]) {
    activeWorkspaceId = id;
    res.status(200).json(getActiveWorkspace());
  } else {
    res.status(404).send('Workspace not found.');
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('a user connected');

  // Send initial state to the new client
  socket.emit('workspace-update', getActiveWorkspace());

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('player-control', (action) => {
    const activeWorkspace = getActiveWorkspace();
    if (!activeWorkspace) return;

    switch (action.type) {
      case 'PLAY':
        activeWorkspace.isPlaying = true;
        activeWorkspace.currentTrack = action.payload.track;
        activeWorkspace.timestamp = 0;
        break;
      case 'PAUSE':
        activeWorkspace.isPlaying = false;
        activeWorkspace.timestamp = action.payload.timestamp;
        break;
      case 'SELECT_TRACK':
        activeWorkspace.currentTrack = action.payload.track;
        activeWorkspace.timestamp = 0;
        activeWorkspace.isPlaying = true;
        break;
    }
    // Broadcast the updated state to all clients
    io.emit('workspace-update', activeWorkspace);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
