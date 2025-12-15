const http = require('http');
const io = require('socket.io-client');

const SERVER = process.env.SERVER || 'http://localhost:3000';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${SERVER}${path}`, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('Starting test');
  try {
    console.log('Testing HTTP endpoints...');
    const w = await get('/workspaces');
    console.log('/workspaces', w.status, w.body);

    const s = await get('/songs');
    console.log('/songs', s.status, s.body);

    console.log('Testing Socket.IO connection...');
    const socket = io(SERVER, { transports: ['websocket'], reconnection: false });
    socket.on('connect', () => {
      console.log('socket connected', socket.id);
      socket.disconnect();
      process.exit(0);
    });
    socket.on('connect_error', (err) => {
      console.error('socket connect_error', err.message);
      process.exit(2);
    });

    // timeout
    setTimeout(() => {
      console.error('Timed out waiting for socket');
      process.exit(3);
    }, 5000);
  } catch (err) {
    console.error('Test error', err.message || err);
    process.exit(1);
  }
})();