const { io } = require('socket.io-client');
const axios = require('axios');

(async () => {
  const login = await axios.post(
    'http://localhost:3001/api/auth/login',
    { username: 'admin', password: 'Admin@2026' }
  );
  const token = login.data.access_token;
  console.log('Token OK');

  const socket = io('http://localhost:3001/events', {
    auth: { token },
  });

  socket.on('connect', () => {
    console.log('Connected:', socket.id);
    socket.emit('ping');
  });

  socket.on('pong', (data) => {
    console.log('Pong received:', data);
    socket.disconnect();
    process.exit(0);
  });

  socket.on('connect_error', (err) => {
    console.error('Connect error:', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('Timeout — no response in 5s');
    process.exit(1);
  }, 5000);
})();
