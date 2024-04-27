import User from '../models/user/user';
import Group from '../models/group/group';

export default interface GroupViewModel {
  group: Group;
  members: User[];
}
