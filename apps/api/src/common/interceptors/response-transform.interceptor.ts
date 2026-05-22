import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  error?: null;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the handler already returned a shaped response, pass it through
        if (
          data !== null &&
          typeof data === 'object' &&
          'data' in (data as object)
        ) {
          return data as unknown as ApiResponse<T>;
        }
        return { data, error: null };
      }),
    );
  }
}
