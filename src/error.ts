export class CozeError extends Error {}

export class APIError extends CozeError {
  readonly status: number | undefined;
  readonly headers: Headers | undefined;
  readonly error: ErrorBody | undefined;

  readonly code: number | null | undefined;
  readonly msg: string | null | undefined;
  readonly detail: string | null | undefined;
  readonly help_doc: string | null | undefined;
  readonly log_id: string | null | undefined;

  constructor(status: number | undefined, error: ErrorBody | undefined, message: string | undefined, headers: Headers | undefined) {
    super(`${APIError.makeMessage(status, error, message, headers)}`);
    this.status = status;
    this.headers = headers;
    this.log_id = headers?.['x-log-id'];

    this.error = error;
    this.code = error?.['code'];
    this.msg = error?.['msg'];
    this.detail = error?.['error']?.['detail'];
    this.help_doc = error?.['error']?.['help_doc'];
  }

  private static makeMessage(
    status: number | undefined,
    errorBody: ErrorBody | undefined,
    message: string | undefined,
    headers: Headers | undefined,
  ) {
    if (!errorBody && message) {
      return message;
    }
    if (errorBody) {
      const list: string[] = [];
      const { code, msg, error } = errorBody;
      if (code) {
        list.push(`code: ${code}`);
      }
      if (msg) {
        list.push(`msg: ${msg}`);
      }
      if (error?.detail && msg !== error.detail) {
        list.push(`detail: ${error.detail}`);
      }
      const logId = error?.logid || headers?.get('x-tt-logid');
      if (logId) {
        list.push(`logid: ${logId}`);
      }

      const help_doc = error?.help_doc || 'https://www.coze.com/docs/developer_guides/coze_error_codes?_lang=en';
      if (help_doc) {
        list.push(`help doc: ${help_doc}`);
      }

      console.log('headers', headers?.get('x-tt-logid'));

      return list.join(', ');
    }

    if (status) {
      return `http status code: ${status} (no body)`;
    }

    return '(no status code or body)';
  }

  static generate(status: number | undefined, errorResponse: ErrorBody | undefined, message: string | undefined, headers: Headers | undefined) {
    if (!status) {
      return new APIConnectionError({ cause: castToError(errorResponse) });
    }

    const error = errorResponse;
    // https://www.coze.cn/docs/developer_guides/coze_error_codes
    if (status === 400 || error?.code === 4000) {
      return new BadRequestError(status, error, message, headers);
    }

    if (status === 401 || error?.code === 4100) {
      return new AuthenticationError(status, error, message, headers);
    }

    if (status === 403 || error?.code === 4101) {
      return new PermissionDeniedError(status, error, message, headers);
    }

    if (status === 404 || error?.code === 4200) {
      return new NotFoundError(status, error, message, headers);
    }

    if (status === 429 || error?.code === 4013) {
      return new RateLimitError(status, error, message, headers);
    }

    if (status === 502) {
      return new GatewayError(status, error, message, headers);
    }

    if (status >= 500) {
      return new InternalServerError(status, error, message, headers);
    }

    return new APIError(status, error, message, headers);
  }
}

export class APIConnectionError extends APIError {
  override readonly status: undefined = undefined;

  constructor({ message, cause }: { message?: string; cause?: Error | undefined }) {
    super(undefined, undefined, message || 'Connection error.', undefined);
    if (cause) this.cause = cause;
  }
}

export class BadRequestError extends APIError {
  override readonly name = 'BadRequestError';
  override readonly status = 400 as const;
}

export class AuthenticationError extends APIError {
  override readonly name = 'AuthenticationError';
  override readonly status = 401 as const;
}

export class PermissionDeniedError extends APIError {
  override readonly name = 'PermissionDeniedError';
  override readonly status = 403 as const;
}

export class NotFoundError extends APIError {
  override readonly name = 'NotFoundError';
  override readonly status = 404 as const;
}

export class RateLimitError extends APIError {
  override readonly name = 'RateLimitError';
  override readonly status = 429 as const;
}

export class InternalServerError extends APIError {
  override readonly name = 'InternalServerError';
  override readonly status = 500 as const;
}

export class GatewayError extends APIError {
  override readonly name = 'GatewayError';
  override readonly status = 502 as const;
}

export const castToError = (err: unknown): Error => {
  if (err instanceof Error) return err;
  return new Error(err as string);
};

export interface ErrorBody {
  code: number;
  msg?: string;
  error?: {
    logid?: string;
    detail?: string;
    help_doc?: string;
  };
}
