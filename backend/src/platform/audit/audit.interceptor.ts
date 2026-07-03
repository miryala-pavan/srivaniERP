import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (!isMutation) return next.handle();

    const userId: string | undefined = req.user?.id;
    const businessId: string | undefined = req.user?.businessId;
    const ipAddress: string = req.ip ?? '';
    const userAgent: string = req.headers['user-agent'] ?? '';
    const action = `${method} ${req.path as string}`;

    return next.handle().pipe(
      tap(() => {
        if (businessId) {
          void this.auditService.log({
            businessId,
            userId,
            action,
            tableName: 'http',
            recordId: req.params?.id ?? '',
            after: req.body as Record<string, unknown>,
            ipAddress,
            userAgent,
          });
        }
      }),
    );
  }
}
