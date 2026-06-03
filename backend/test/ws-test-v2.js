const { io } = require('socket.io-client');
const axios = require('axios');

const BASE = 'http://localhost:4001/api';
const received = [];

(async () => {
  const login = await axios.post(`${BASE}/auth/login`, { username: 'admin', password: 'Admin@2026' });
  const token = login.data.access_token;
  const businessId = login.data.user.businessId;
  console.log('Token OK, businessId:', businessId);

  const socket = io('http://localhost:4001/events', { auth: { token } });

  socket.on('connect', () => console.log('WS connected:', socket.id));
  socket.on('connect_error', (err) => { console.error('WS error:', err.message); process.exit(1); });

  // Listen for all known events
  const allEvents = [
    'shift.opened', 'shift.closed', 'bill.created', 'bill.voided',
    'grn.approved', 'plu.updated', 'product.created', 'product.updated',
    'day.opened', 'day.closed',
  ];
  allEvents.forEach((ev) => {
    socket.on(ev, (payload) => {
      console.log(`[EVENT] ${ev}:`, JSON.stringify(payload));
      received.push({ event: ev, payload });
    });
  });

  // Wait for connection then trigger product.updated via API
  await new Promise((r) => setTimeout(r, 500));

  // Fetch a product to update
  const products = await axios.get(`${BASE}/products?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const product = products.data.data?.[0];
  if (!product) {
    console.error('No products found — cannot trigger product.updated');
    process.exit(1);
  }
  console.log('Updating product:', product.productCode, product.name);

  await axios.put(
    `${BASE}/products/${product.id}`,
    { name: product.name },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  console.log('PATCH sent — waiting 1.5s for events...');

  await new Promise((r) => setTimeout(r, 1500));

  console.log(`\nReceived ${received.length} event(s):`);
  received.forEach((r) => console.log(`  - ${r.event}`));
  if (received.length === 0) {
    console.error('FAIL: no events received');
    process.exit(1);
  }
  console.log('PASS');
  socket.disconnect();
  process.exit(0);
})().catch((err) => { console.error(err.message); process.exit(1); });
