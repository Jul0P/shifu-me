import request from 'supertest';
import app from '../../src/app';

export function testApi() {
  return request(app);
}
