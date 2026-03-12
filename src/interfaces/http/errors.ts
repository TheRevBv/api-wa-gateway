import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";
import { ZodError } from "zod";

import { ApplicationError } from "../../application/errors/application-error";

export const registerErrorHandler = (app: FastifyInstance<any, any, any, Logger>) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: error.flatten()
        }
      });
      return;
    }

    if (error instanceof ApplicationError) {
      void reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message
        }
      });
      return;
    }

    void reply.status(500).send({
      error: {
        code: "internal_server_error",
        message: "Unexpected server error"
      }
    });
  });
};
