import { RequestHandler } from 'express';
import createError from 'http-errors';

export default function requireFeatureEnabled(
  featureEnabled: boolean,
): RequestHandler {
  return (_req, _res, next) => {
    if (!featureEnabled) {
      next(createError(404));
      return;
    }

    next();
  };
}
