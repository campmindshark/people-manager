import axios from 'axios';
import {
  ChoreCatalogResponse,
  ChoreCatalogScoreUpdateRequest,
  ChoreCatalogScoreUpdateResponse,
} from 'backend/view_models/chore_catalog';

export default class BackendChoreCatalogClient {
  private readonly baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetCatalog(): Promise<ChoreCatalogResponse> {
    const { data } = await axios.get<ChoreCatalogResponse>(
      `${this.baseApiURL}/api/chore-plans/catalog`,
      { withCredentials: true },
    );
    return data;
  }

  async UpdateScore(
    definitionKey: string,
    request: ChoreCatalogScoreUpdateRequest,
  ): Promise<ChoreCatalogScoreUpdateResponse> {
    const { data } = await axios.put<ChoreCatalogScoreUpdateResponse>(
      `${this.baseApiURL}/api/chore-plans/catalog/${encodeURIComponent(
        definitionKey,
      )}/score`,
      request,
      { withCredentials: true },
    );
    return data;
  }
}
