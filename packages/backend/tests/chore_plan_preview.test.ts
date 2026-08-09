import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import knexFactory, { Knex } from 'knex';
import ChorePlanPreviewController from '../controllers/chore_plan_preview';
import { CHORE_CATALOG_V2 } from '../migrations/data/chore_catalog_v2';
import RoleConfigCollection from '../roles/role';
import buildChorePlanPreview from '../utils/chorePlanPreview';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import {
  parseChorePlanApplyRequest,
  parseChorePlanPreviewRequest,
  parseChorePlanRosterID,
} from '../utils/chorePlanPreviewInput';
import { ChoreCatalogDefinitionView } from '../view_models/chore_catalog';
import { ChorePlanPreviewRequest } from '../view_models/chore_plan_preview';

const TEST_DATABASE_URL = process.env.CHORE_TEARDOWN_TEST_DATABASE_URL;
const POSTGRES_TEST_OPTIONS = {
  skip: TEST_DATABASE_URL
    ? false
    : 'CHORE_TEARDOWN_TEST_DATABASE_URL is not configured.',
  timeout: 120_000,
};
const DEFAULT_REQUEST: ChorePlanPreviewRequest = {
  rosterID: 1,
  camperCount: 1,
  requirements: { chore: 1, event: 1, dinner: 1 },
};

interface IDRow {
  id: number;
}

function assertSafeTestDatabaseURL(databaseURL: string | undefined): string {
  assert(databaseURL, 'CHORE_TEARDOWN_TEST_DATABASE_URL must be set.');
  const parsedURL = new URL(databaseURL);
  assert(
    ['127.0.0.1', 'localhost'].includes(parsedURL.hostname),
    'The preview test only runs against PostgreSQL on the local machine.',
  );
  assert.equal(
    parsedURL.pathname,
    '/people_manager_chore_teardown_test',
    'The preview test requires its dedicated disposable database.',
  );
  return databaseURL;
}

function catalogDefinitions(): ChoreCatalogDefinitionView[] {
  return CHORE_CATALOG_V2.map((definition) => ({
    ...definition,
    endDayOffset: definition.endDayOffset as 0 | 1,
  }));
}

function build(
  request: ChorePlanPreviewRequest = DEFAULT_REQUEST,
  definitions = catalogDefinitions(),
) {
  return buildChorePlanPreview({
    ...request,
    year: 2026,
    catalogRevision: '2',
    definitions,
  });
}

function isPreviewError(
  error: unknown,
  status: number,
  message: RegExp,
): boolean {
  return (
    error instanceof ChorePlanPreviewError &&
    error.status === status &&
    message.test(error.message)
  );
}

test('preview input accepts only bounded roster, camper, and requirement values', () => {
  assert.deepEqual(
    parseChorePlanPreviewRequest(DEFAULT_REQUEST),
    DEFAULT_REQUEST,
  );
  assert.equal(
    parseChorePlanPreviewRequest({ ...DEFAULT_REQUEST, camperCount: 200 })
      .camperCount,
    200,
  );
  assert.throws(
    () => parseChorePlanPreviewRequest({ ...DEFAULT_REQUEST, camperCount: 0 }),
    (error) => isPreviewError(error, 400, /1 to 200/i),
  );
  assert.throws(
    () =>
      parseChorePlanPreviewRequest({ ...DEFAULT_REQUEST, camperCount: 201 }),
    (error) => isPreviewError(error, 400, /1 to 200/i),
  );
  assert.throws(
    () =>
      parseChorePlanPreviewRequest({
        ...DEFAULT_REQUEST,
        requirements: { chore: 21, event: 1, dinner: 1 },
      }),
    (error) => isPreviewError(error, 400, /0 to 20/i),
  );
  assert.throws(
    () =>
      parseChorePlanPreviewRequest({
        ...DEFAULT_REQUEST,
        expectedRevision: '1',
      }),
    (error) => isPreviewError(error, 400, /accepts only/i),
  );
});

test('apply input accepts only preview inputs and both observed revisions', () => {
  assert.equal(parseChorePlanRosterID('7'), 7);
  assert.throws(
    () => parseChorePlanRosterID('7.5'),
    (error) => isPreviewError(error, 400, /valid roster/i),
  );
  assert.deepEqual(
    parseChorePlanApplyRequest({
      ...DEFAULT_REQUEST,
      expectedCatalogRevision: '7',
      expectedDraftRevision: null,
    }),
    {
      ...DEFAULT_REQUEST,
      expectedCatalogRevision: '7',
      expectedDraftRevision: null,
    },
  );
  assert.equal(
    parseChorePlanApplyRequest({
      ...DEFAULT_REQUEST,
      expectedCatalogRevision: '7',
      expectedDraftRevision: '3',
    }).expectedDraftRevision,
    '3',
  );
  assert.deepEqual(
    parseChorePlanApplyRequest({
      ...DEFAULT_REQUEST,
      disabledAssignments: [
        {
          shiftKey: 'chore|1|chore-am-chum-wench-first',
          definitionKey: 'chore-am-chum-wench-first',
        },
      ],
      expectedCatalogRevision: '7',
      expectedDraftRevision: '3',
    }).disabledAssignments,
    [
      {
        shiftKey: 'chore|1|chore-am-chum-wench-first',
        definitionKey: 'chore-am-chum-wench-first',
      },
    ],
  );
  assert.throws(
    () =>
      parseChorePlanPreviewRequest({
        ...DEFAULT_REQUEST,
        disabledAssignments: [
          {
            shiftKey: 'chore|1|chore-am-chum-wench-first',
            definitionKey: 'chore-am-chum-wench-first',
          },
          {
            shiftKey: 'chore|1|chore-am-chum-wench-first',
            definitionKey: 'chore-am-chum-wench-first',
          },
        ],
      }),
    (error) => isPreviewError(error, 400, /unique/i),
  );
  assert.throws(
    () =>
      parseChorePlanApplyRequest({
        ...DEFAULT_REQUEST,
        expectedCatalogRevision: 7,
        expectedDraftRevision: null,
      }),
    (error) => isPreviewError(error, 400, /catalog revision/i),
  );
  assert.throws(
    () =>
      parseChorePlanApplyRequest({
        ...DEFAULT_REQUEST,
        expectedCatalogRevision: '7',
        expectedDraftRevision: '0',
      }),
    (error) => isPreviewError(error, 400, /draft revision/i),
  );
  assert.throws(
    () =>
      parseChorePlanApplyRequest({
        ...DEFAULT_REQUEST,
        expectedCatalogRevision: '7',
        expectedDraftRevision: null,
        shifts: [],
      }),
    (error) => isPreviewError(error, 400, /accepts only/i),
  );
});

test('filtered event periods preserve surviving stable identities', () => {
  const definitions = catalogDefinitions();
  assert.equal(
    definitions.find(({ stableKey }) => stableKey === 'event-04-bar-manager'),
    undefined,
  );
  assert.deepEqual(
    definitions.find(({ stableKey }) => stableKey === 'event-05-bar-manager'),
    {
      stableKey: 'event-05-bar-manager',
      kind: 'event',
      shiftLabel: 'Bar',
      positionLabel: 'Manager',
      dayMode: 'explicit',
      dayNumber: 2,
      dayLabel: 'Monday',
      timePeriodLabel: '12p-3p',
      periodOrder: 4,
      startLocalTime: '12:00:00',
      endLocalTime: '15:00:00',
      endDayOffset: 0,
      sourceOrder: 24,
      score: 100,
    },
  );
});

test('pure preview is deterministic, ordered, offline, and identifies every slot', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('The planner must not access the network.');
  };

  try {
    const first = build();
    const second = build(DEFAULT_REQUEST, catalogDefinitions().reverse());
    assert.deepEqual(second, first);
    assert.equal(JSON.stringify(second), JSON.stringify(first));
    assert.deepEqual(first.categories, {
      chore: { target: 1, selected: 1, shortage: 0 },
      event: { target: 1, selected: 1, shortage: 0 },
      dinner: { target: 1, selected: 1, shortage: 0 },
    });
    assert.equal(first.shifts.length, 3);
    assert.deepEqual(
      first.shifts.map(({ kind }) => kind),
      ['chore', 'dinner', 'event'],
    );
    assert.deepEqual(first.shifts[0], {
      stableKey: 'chore|1|chore-am-chum-wench-first',
      scheduleKey: 'chore|AM Chum Wench',
      kind: 'chore',
      scheduleName: 'AM Chum Wench',
      displayDayNumber: 1,
      displayDayLabel: 'Sunday, Aug 30',
      calendarDay: 1,
      timePeriodLabel: '11:00:00 AM',
      periodOrder: null,
      startTime: '2026-08-30T18:00:00.000Z',
      endTime: '2026-08-30T19:00:00.000Z',
      requiredParticipants: 1,
      totalScore: 100,
      slots: [
        {
          definitionKey: 'chore-am-chum-wench-first',
          positionLabel: 'First',
          score: 100,
        },
      ],
    });
    assert.equal(
      new Set(
        first.shifts.flatMap(({ slots }) =>
          slots.map(({ definitionKey }) => definitionKey),
        ),
      ).size,
      3,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('preview reports exact shortages at maximum input capacity', () => {
  const preview = build({
    ...DEFAULT_REQUEST,
    camperCount: 200,
    requirements: { chore: 20, event: 20, dinner: 20 },
  });
  assert.deepEqual(preview.categories, {
    chore: { target: 4000, selected: 224, shortage: 3776 },
    event: { target: 4000, selected: 216, shortage: 3784 },
    dinner: { target: 4000, selected: 54, shortage: 3946 },
  });
});

test('a disabled assignment is replaced while its sibling remains', () => {
  const initial = build({
    ...DEFAULT_REQUEST,
    camperCount: 3,
    requirements: { chore: 20, event: 0, dinner: 0 },
  });
  const multiPositionShift = initial.shifts.find(
    (shift) => shift.slots.length > 1,
  );
  assert(multiPositionShift);
  const disabledSlot = multiPositionShift.slots[0];
  const retainedSlot = multiPositionShift.slots[1];
  const disabledAssignment = {
    shiftKey: multiPositionShift.stableKey,
    definitionKey: disabledSlot.definitionKey,
  };
  const replacement = build({
    ...DEFAULT_REQUEST,
    camperCount: 3,
    requirements: { chore: 20, event: 0, dinner: 0 },
    disabledAssignments: [disabledAssignment],
  });
  const updatedShift = replacement.shifts.find(
    ({ stableKey }) => stableKey === multiPositionShift.stableKey,
  );

  assert.deepEqual(replacement.disabledAssignments, [disabledAssignment]);
  assert.deepEqual(replacement.categories.chore, {
    target: 60,
    selected: 60,
    shortage: 0,
  });
  assert(updatedShift);
  assert.equal(
    updatedShift.slots.some(
      ({ definitionKey }) => definitionKey === disabledSlot.definitionKey,
    ),
    false,
  );
  assert.equal(
    updatedShift.slots.some(
      ({ definitionKey }) => definitionKey === retainedSlot.definitionKey,
    ),
    true,
  );
});

test('a disabled assignment is replaced by the highest score across shifts', () => {
  const request: ChorePlanPreviewRequest = {
    ...DEFAULT_REQUEST,
    requirements: { chore: 8, event: 0, dinner: 0 },
  };
  const initial = build(request);
  const dinnerServeSunday = initial.shifts.find(
    ({ stableKey }) => stableKey === 'chore|1|chore-dinner-serve-first',
  );
  assert(dinnerServeSunday);
  assert.deepEqual(dinnerServeSunday.slots, [
    {
      definitionKey: 'chore-dinner-serve-first',
      positionLabel: 'First',
      score: 100,
    },
  ]);

  const replacement = build({
    ...request,
    disabledAssignments: [
      {
        shiftKey: dinnerServeSunday.stableKey,
        definitionKey: dinnerServeSunday.slots[0].definitionKey,
      },
    ],
  });
  const initialAssignments = new Set(
    initial.shifts.flatMap((shift) =>
      shift.slots.map((slot) => `${shift.stableKey}|${slot.definitionKey}`),
    ),
  );
  const addedAssignments = replacement.shifts.flatMap((shift) =>
    shift.slots
      .filter(
        (slot) =>
          !initialAssignments.has(`${shift.stableKey}|${slot.definitionKey}`),
      )
      .map((slot) => ({
        shiftKey: shift.stableKey,
        definitionKey: slot.definitionKey,
        score: slot.score,
      })),
  );

  assert.deepEqual(replacement.categories.chore, {
    target: 8,
    selected: 8,
    shortage: 0,
  });
  assert.deepEqual(addedAssignments, [
    {
      shiftKey: 'chore|2|chore-am-chum-wench-first',
      definitionKey: 'chore-am-chum-wench-first',
      score: 100,
    },
  ]);
  assert.equal(
    replacement.shifts.some(
      ({ stableKey, slots }) =>
        stableKey === dinnerServeSunday.stableKey &&
        slots.some(
          ({ definitionKey }) => definitionKey === 'chore-dinner-serve-second',
        ),
    ),
    false,
  );
});

test('closing Sunday event periods retain Saturday display grouping and actual time', () => {
  const definitions = catalogDefinitions().map((definition) =>
    definition.kind === 'event' ? { ...definition, score: 0 } : definition,
  );
  const closingPeriod = Math.max(
    ...definitions
      .filter(({ kind }) => kind === 'event')
      .map(({ periodOrder }) => periodOrder ?? 0),
  );
  const closingGroup = definitions.filter(
    ({ kind, periodOrder, shiftLabel }) =>
      kind === 'event' &&
      periodOrder === closingPeriod &&
      shiftLabel === 'Audio',
  );
  assert(closingGroup[0]);
  assert.equal(closingGroup[0].dayNumber, 8);
  closingGroup[0].score = 100;

  const preview = build(
    {
      ...DEFAULT_REQUEST,
      requirements: { chore: 0, event: 1, dinner: 0 },
    },
    definitions,
  );
  assert.deepEqual(preview.shifts[0], {
    stableKey: 'event|8|event-39-audio-manager',
    scheduleKey: 'event|Audio',
    kind: 'event',
    scheduleName: 'Audio',
    displayDayNumber: 7,
    displayDayLabel: 'Saturday, Sep 5',
    calendarDay: 8,
    timePeriodLabel: '12a-3a',
    periodOrder: 33,
    startTime: '2026-09-06T07:00:00.000Z',
    endTime: '2026-09-06T10:00:00.000Z',
    requiredParticipants: 1,
    totalScore: 100,
    slots: [
      {
        definitionKey: 'event-39-audio-manager',
        positionLabel: 'Manager',
        score: 100,
      },
    ],
  });
});

test('pure preview rejects incomplete or internally invalid stored catalogs', () => {
  assert.throws(
    () => build(DEFAULT_REQUEST, catalogDefinitions().slice(1)),
    (error) => isPreviewError(error, 500, /count/i),
  );

  const invalidScore = catalogDefinitions();
  invalidScore[0] = { ...invalidScore[0], score: 1.234 };
  assert.throws(
    () => build(DEFAULT_REQUEST, invalidScore),
    (error) => isPreviewError(error, 500, /two decimals/i),
  );

  const inconsistentGroup = catalogDefinitions();
  inconsistentGroup[8] = {
    ...inconsistentGroup[8],
    timePeriodLabel: '10:00:00 AM',
  };
  assert.throws(
    () => build(DEFAULT_REQUEST, inconsistentGroup),
    (error) =>
      isPreviewError(error, 500, /fixed catalog field timePeriodLabel/i),
  );

  const invalidPeriodOrder = catalogDefinitions().map((definition) =>
    definition.kind === 'event'
      ? {
          ...definition,
          periodOrder: (definition.periodOrder ?? 0) + 1,
        }
      : definition,
  );
  assert.throws(
    () => build(DEFAULT_REQUEST, invalidPeriodOrder),
    (error) => isPreviewError(error, 500, /fixed catalog field periodOrder/i),
  );

  const excludedEventPeriod = catalogDefinitions();
  const firstEventIndex = excludedEventPeriod.findIndex(
    ({ kind }) => kind === 'event',
  );
  assert.notEqual(firstEventIndex, -1);
  excludedEventPeriod[firstEventIndex] = {
    ...excludedEventPeriod[firstEventIndex],
    timePeriodLabel: '3 am - 6 am',
  };
  assert.throws(
    () => build(DEFAULT_REQUEST, excludedEventPeriod),
    (error) => isPreviewError(error, 500, /camp-excluded 3a-6a/i),
  );
});

test('pure preview enforces fixed catalog metadata while allowing score edits', () => {
  const changedPosition = catalogDefinitions();
  changedPosition[0] = {
    ...changedPosition[0],
    positionLabel: 'Tampered Position',
  };
  assert.throws(
    () => build(DEFAULT_REQUEST, changedPosition),
    (error) => isPreviewError(error, 500, /fixed catalog field positionLabel/i),
  );

  const changedKey = catalogDefinitions();
  changedKey[0] = {
    ...changedKey[0],
    stableKey: 'chore-am-chum-wench-tampered',
  };
  assert.throws(
    () => build(DEFAULT_REQUEST, changedKey),
    (error) => isPreviewError(error, 500, /not in the fixed catalog/i),
  );

  const changedScore = catalogDefinitions();
  changedScore[0] = { ...changedScore[0], score: 99 };
  const preview = build(
    {
      ...DEFAULT_REQUEST,
      requirements: { chore: 1, event: 0, dinner: 0 },
    },
    changedScore,
  );
  assert.equal(preview.shifts[0].slots[0].score, 99);
});

test('admin role has a preview permission separate from catalog editing', () => {
  assert.equal(
    RoleConfigCollection.hasPermission([1], 'chorePlans:preview'),
    true,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([], 'chorePlans:preview'),
    false,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([1], 'chorePlans:apply'),
    true,
  );
  assert.equal(
    RoleConfigCollection.hasPermission([], 'chorePlans:apply'),
    false,
  );
});

test(
  'database preview uses a consistent revision snapshot and performs no writes',
  POSTGRES_TEST_OPTIONS,
  async () => {
    const databaseURL = assertSafeTestDatabaseURL(TEST_DATABASE_URL);
    const adminDatabase = knexFactory({
      client: 'postgresql',
      connection: databaseURL,
      pool: { max: 2, min: 0 },
    });
    const schemaName = `chore_plan_preview_${Date.now()}`;
    let database: Knex | undefined;
    let scoreTransaction: Knex.Transaction | undefined;

    try {
      await adminDatabase.schema.createSchema(schemaName);
      database = knexFactory({
        client: 'postgresql',
        connection: databaseURL,
        migrations: { extension: 'ts', tableName: 'knex_migrations' },
        pool: { max: 5, min: 0 },
        searchPath: [schemaName],
      });
      await database.migrate.latest({
        directory: path.resolve(__dirname, '../migrations'),
        extension: 'ts',
      });
      const [roster] = (await database('rosters')
        .insert({ year: 2026 })
        .returning('id')) as IDRow[];
      const controller = new ChorePlanPreviewController(database);
      const request: ChorePlanPreviewRequest = {
        rosterID: roster.id,
        camperCount: 1,
        requirements: { chore: 0, event: 1, dinner: 0 },
      };

      const initial = await controller.preview(request);
      assert.equal(initial.catalogRevision, '2');
      assert.equal(
        initial.shifts[0].slots[0].definitionKey,
        'event-01-bar-manager',
      );
      assert.equal(
        Number(
          (await database('chore_plans').count('* as count').first())?.count,
        ),
        0,
      );
      assert.equal(
        Number(
          (
            await database('chore_catalog_score_audit_entries')
              .count('* as count')
              .first()
          )?.count,
        ),
        0,
      );

      scoreTransaction = await database.transaction();
      await scoreTransaction('chore_catalog_state')
        .where({ id: 1 })
        .forUpdate()
        .first();
      await scoreTransaction('chore_catalog_scores')
        .where({ definitionKey: 'event-01-bar-manager' })
        .update({ score: 0 });
      await scoreTransaction('chore_catalog_state')
        .where({ id: 1 })
        .update({ revision: 3 });

      const whileUncommitted = await controller.preview(request);
      assert.equal(whileUncommitted.catalogRevision, '2');
      assert.equal(
        whileUncommitted.shifts[0].slots[0].definitionKey,
        'event-01-bar-manager',
      );

      await scoreTransaction.commit();
      scoreTransaction = undefined;
      const afterCommit = await controller.preview(request);
      assert.equal(afterCommit.catalogRevision, '3');
      assert.equal(
        afterCommit.shifts[0].slots[0].definitionKey,
        'event-02-audio-manager',
      );
      assert.equal(
        Number(
          (await database('chore_plans').count('* as count').first())?.count,
        ),
        0,
      );

      await assert.rejects(
        controller.preview({ ...request, rosterID: roster.id + 1000 }),
        (error) => isPreviewError(error, 404, /roster not found/i),
      );
    } finally {
      if (scoreTransaction && !scoreTransaction.isCompleted()) {
        await scoreTransaction.rollback();
      }
      await database?.destroy();
      await adminDatabase.schema.dropSchemaIfExists(schemaName, true);
      await adminDatabase.destroy();
    }
  },
);
