import axios from 'axios';
import Group from 'backend/models/group/group';
import GroupViewModel from 'backend/view_models/group';
import defaultRequestConfig from '../common/requestConfig';

export default class BackendGroupClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllGroups(): Promise<GroupViewModel[]> {
    const { data } = await axios.get<GroupViewModel[]>(
      `${this.baseApiURL}/api/groups/viewModels`,
      defaultRequestConfig,
    );
    return data;
  }

  async CreateGroup(newGroup: Group): Promise<Group> {
    const { data } = await axios.post<Group>(
      `${this.baseApiURL}/api/groups`,
      newGroup,
      defaultRequestConfig,
    );
    return data;
  }

  async UpdateGroup(updatedGroup: Group): Promise<Group> {
    const { data } = await axios.put<Group>(
      `${this.baseApiURL}/api/groups/${updatedGroup.id}`,
      updatedGroup,
      defaultRequestConfig,
    );
    return data;
  }

  async GetGroupMembers(groupID: number): Promise<number[]> {
    const { data } = await axios.get<number[]>(
      `${this.baseApiURL}/api/groups/${groupID}/members`,
      defaultRequestConfig,
    );
    return data;
  }
}
