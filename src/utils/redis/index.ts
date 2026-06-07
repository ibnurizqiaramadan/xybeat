/* eslint-disable require-jsdoc */
import { initialize, disconnect, isRedisEnabled } from './client';
import * as queue from './queue';
import * as state from './state';

export const redisManager = {
  initialize,
  disconnect,
  isRedisEnabled,
  ...queue,
  ...state,
};
