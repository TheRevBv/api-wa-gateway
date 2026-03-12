export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, options?: { code?: string; statusCode?: number }) {
    super(message);
    this.name = "ApplicationError";
    this.code = options?.code ?? "application_error";
    this.statusCode = options?.statusCode ?? 400;
  }
}
