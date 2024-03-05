import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import User from '../models/user/user';

const knex = Knex(knexConfig[getConfig().Environment]);

export default class UserController {
  public static async updateUser(user: User, id: number): Promise<User> {
    const skillsOfNote = user.skillsOfNote;
    user.skillsOfNote = [];

    const query = User.query().update(user).where('id', id);
    await query;

    const jsonQuery = knex('users')
      .update({
        skillsOfNote: JSON.stringify(skillsOfNote),
      })
      .where('id', id);
    await jsonQuery;

    const recollectQuery = User.query().findById(id);
    const updatedUser = await recollectQuery;
    if (!updatedUser) {
      throw new Error('User not found');
    }

    return updatedUser;
  }
}
