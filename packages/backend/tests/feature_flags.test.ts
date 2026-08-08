import assert from 'node:assert/strict';
import test from 'node:test';
import { Request, Response } from 'express';
import { HttpError } from 'http-errors';
import { getConfig } from '../config/config';
import requireFeatureEnabled from '../middleware/feature_flag';

function invokeFeatureGuard(featureEnabled: boolean): Error | undefined {
  let nextError: Error | undefined;
  const featureGuard = requireFeatureEnabled(featureEnabled);

  featureGuard({} as Request, {} as Response, (error?: unknown) => {
    nextError = error as Error | undefined;
  });

  return nextError;
}

test('chore planning defaults to disabled', () => {
  assert.equal(getConfig({}).ChorePlanningEnabled, false);
});

test('only the exact true value enables chore planning', () => {
  assert.equal(
    getConfig({ CHORE_PLANNING_ENABLED: 'true' }).ChorePlanningEnabled,
    true,
  );
  assert.equal(
    getConfig({ CHORE_PLANNING_ENABLED: 'TRUE' }).ChorePlanningEnabled,
    false,
  );
  assert.equal(
    getConfig({ CHORE_PLANNING_ENABLED: '1' }).ChorePlanningEnabled,
    false,
  );
});

test('disabled feature routes appear absent', () => {
  const error = invokeFeatureGuard(false) as HttpError;

  assert.equal(error.status, 404);
});

test('enabled feature routes continue to their handler', () => {
  assert.equal(invokeFeatureGuard(true), undefined);
});
