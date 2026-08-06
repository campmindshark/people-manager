export type ChoreCatalogKind = 'chore' | 'event' | 'dinner';
export type ChoreCatalogDayMode = 'template' | 'explicit';

export interface ChoreCatalogDefinitionView {
  stableKey: string;
  kind: ChoreCatalogKind;
  shiftLabel: string;
  positionLabel: string;
  dayMode: ChoreCatalogDayMode;
  dayNumber: number | null;
  dayLabel: string | null;
  timePeriodLabel: string;
  periodOrder: number | null;
  startLocalTime: string;
  endLocalTime: string;
  endDayOffset: 0 | 1;
  sourceOrder: number;
  score: number;
}

export interface ChoreCatalogResponse {
  revision: string;
  definitions: ChoreCatalogDefinitionView[];
}

export interface ChoreCatalogScoreUpdateRequest {
  score: number;
  expectedRevision: string;
}

export interface ChoreCatalogScoreUpdateResponse {
  revision: string;
  definition: ChoreCatalogDefinitionView;
}
