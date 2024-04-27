import { selector } from 'recoil';
import GroupViewModel from 'backend/view_models/group';
import { getFrontendConfig } from '../config/config';
import BackendGroupClient from '../api/groups/groups';

const frontendConfig = getFrontendConfig();

const GroupsState = selector<GroupViewModel[]>({
  key: 'groups',
  get: async () => {
    const apiMethod = new BackendGroupClient(frontendConfig.BackendURL);
    const groups = await apiMethod.GetAllGroups();

    return groups;
  },
});

export default GroupsState;
