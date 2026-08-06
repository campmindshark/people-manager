import { Knex } from 'knex';
import Roster from '../models/roster/roster';
import {
  ChorePlanPreview,
  ChorePlanPreviewRequest,
} from '../view_models/chore_plan_preview';
import buildChorePlanPreview from '../utils/chorePlanPreview';
import ChorePlanPreviewError from '../utils/chorePlanPreviewError';
import ChoreCatalogController from './chore_catalog';

interface RosterRow {
  id: number;
  year: number;
}

export default class ChorePlanPreviewController {
  private readonly database?: Knex;

  constructor(database?: Knex) {
    this.database = database;
  }

  private getDatabase(): Knex {
    return this.database ?? Roster.knex();
  }

  async preview(input: ChorePlanPreviewRequest): Promise<ChorePlanPreview> {
    return this.getDatabase().transaction(async (transaction) => {
      await transaction.raw(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const roster = (await transaction('rosters')
        .select('id', 'year')
        .where({ id: input.rosterID })
        .first()) as RosterRow | undefined;
      if (!roster) {
        throw new ChorePlanPreviewError('Roster not found.', 404);
      }

      const catalog = await new ChoreCatalogController(
        transaction,
      ).getCatalog();
      return buildChorePlanPreview({
        ...input,
        year: roster.year,
        catalogRevision: catalog.revision,
        definitions: catalog.definitions,
      });
    });
  }
}
