import { errorResponseSchema } from '@shifu/shared';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { ApiError } from '../../src/lib/api-error';
import { errorHandler } from '../../src/middleware/errors.middleware';

test.each([
  [new ApiError(409, 'ROUND_EXPIRED', 'Manche expirée'), 409, 'ROUND_EXPIRED'],
  [Object.assign(new Error('détails privés'), { code: 11000 }), 409, 'CONFLICT'],
  [Object.assign(new Error('détails privés'), { name: 'MongoNetworkError' }), 503, 'DATABASE_UNAVAILABLE'],
  [Object.assign(new Error('détails privés'), { name: 'MongoServerSelectionError' }), 503, 'DATABASE_UNAVAILABLE'],
  [new mongoose.mongo.MongoNetworkTimeoutError('détails privés'), 503, 'DATABASE_UNAVAILABLE'],
  [new mongoose.Error.MongooseServerSelectionError('détails privés'), 503, 'DATABASE_UNAVAILABLE'],
  [new TypeError('détails privés'), 500, 'INTERNAL_ERROR'],
])("l'erreur %s est traduite en %s/%s sans divulguer les détails internes", async (error, status, code) => {
  const application = express();
  application.get('/error', () => {
    throw error;
  });
  application.use(errorHandler);
  const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const response = await request(application).get('/error').expect(status);
  const body = errorResponseSchema.parse(response.body);
  expect(body.error.code).toBe(code);
  expect(JSON.stringify(body)).not.toContain('détails privés');
  expect(body.error).not.toHaveProperty('stack');
  if (status === 500) {
    expect(log).toHaveBeenCalledWith('API INTERNAL_ERROR', 'TypeError');
  } else {
    expect(log).not.toHaveBeenCalled();
  }
});
