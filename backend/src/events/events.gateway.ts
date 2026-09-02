import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { isAllowedOrigin } from '../common/helpers/cors-origin.util';

@WebSocketGateway({
  cors: {
    // Same shared origin check as the HTTP CORS config (main.ts) — this used
    // to be just process.env.FRONTEND_URL (the ERP dashboard's one origin),
    // which silently rejected every other app's (storefront, rider) browser
    // WebSocket connections. See cors-origin.util.ts's comment for why this
    // gap was invisible to Node-based WS testing.
    origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
      const ok = isAllowedOrigin(origin);
      cb(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth as any)?.token || (client.handshake.query?.token as string);
    const deliveryToken = (client.handshake.auth as any)?.deliveryToken || (client.handshake.query?.deliveryToken as string);

    // Mode 1: staff JWT (existing) — full business-room access.
    if (token) {
      try {
        const payload = this.jwtService.verify(token, { secret: this.configService.get<string>('JWT_SECRET') });
        client.data.user = payload;
        client.data.businessId = payload.businessId;
        client.join(`business:${payload.businessId}`);
        console.log(`WS connected: ${client.id}, user: ${payload.username}`);
        return;
      } catch {
        // Fall through — not a staff token. Also try it as a rider token
        // before giving up, since both arrive on the same `token` field.
      }
      try {
        const payload = this.jwtService.verify(token, { secret: this.configService.get<string>('RIDER_JWT_SECRET') });
        if (payload?.type === 'delivery_boy' && payload.deliveryBoyId) {
          client.data.deliveryBoyId = payload.deliveryBoyId;
          client.data.businessId = payload.businessId;
          client.join(`business:${payload.businessId}`);
          client.join(`rider:${payload.deliveryBoyId}`);
          console.log(`WS connected: ${client.id}, rider: ${payload.deliveryBoyId}`);
          return;
        }
      } catch {
        // Not a valid rider token either — fall through to token-only mode below.
      }
    }

    // Mode 2: public delivery-tracking token — read-only, scoped to exactly
    // one delivery's room. No JWT at all: the unguessable trackingToken IS
    // the access control, same pattern as HistoryService's public link.
    if (deliveryToken) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { trackingToken: deliveryToken },
        select: { id: true },
      });
      if (delivery) {
        client.data.readOnly = true;
        client.join(`delivery:${delivery.id}`);
        console.log(`WS connected: ${client.id}, tracking delivery: ${delivery.id} (read-only)`);
        return;
      }
    }

    client.disconnect();
  }

  handleDisconnect(client: Socket) {
    console.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    if (client.data.readOnly) return; // token-mode clients never get to trigger server-side actions
    return {
      event: 'pong',
      data: {
        time: new Date().toISOString(),
        socketId: client.id,
      },
    };
  }
}
