#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Srivani ERP — Hetzner CPX22 first-time setup
# Run ONCE on a fresh Ubuntu 22.04 server as root:
#   bash server-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "▶ Updating system..."
apt update && apt upgrade -y

echo "▶ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "▶ Installing PM2..."
npm install -g pm2

echo "▶ Installing Docker..."
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
| tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "▶ Installing Nginx + Certbot..."
apt install -y nginx certbot python3-certbot-nginx

echo "▶ Setting up firewall..."
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

echo "▶ Creating storage directories..."
mkdir -p /var/srivani/storage/product-images
mkdir -p /var/srivani/storage/payment-proofs
mkdir -p /var/srivani/app

echo "▶ Starting PostgreSQL via Docker..."
docker run -d \
  --name srivani-db \
  --restart unless-stopped \
  -e POSTGRES_USER=srivani \
  -e POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD \
  -e POSTGRES_DB=srivanidb \
  -p 5432:5432 \
  -v srivani_pgdata:/var/lib/postgresql/data \
  postgres:15

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Upload backend code:  scp (see deploy-to-server.bat on your PC)"
echo "  2. Create /var/srivani/app/backend/.env (copy from .env.example)"
echo "  3. Run: cd /var/srivani/app/backend && npm install && npx prisma migrate deploy && npm run build"
echo "  4. Run: pm2 start dist/main.js --name srivani-backend && pm2 save && pm2 startup"
echo "  5. Set up Nginx: cp /var/srivani/app/scripts/nginx-erp.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
echo "  6. SSL: certbot --nginx -d YOUR_DOMAIN"
