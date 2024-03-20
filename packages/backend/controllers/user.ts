import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import User from '../models/user/user';
import PrivateProfile from '../models/user/user_private';

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

  public static async createPrivateProfile(
    privateProfile: PrivateProfile,
    userID: number,
  ): Promise<PrivateProfile> {
    const query = PrivateProfile.query().insert({
      ...privateProfile,
      userID: userID,
    });
    await query;

    const recollectQuery = PrivateProfile.query().where('userID', userID);
    const updatedPrivateProfile = await recollectQuery;
    if (!updatedPrivateProfile) {
      throw new Error('PrivateProfile not found');
    }

    if (updatedPrivateProfile.length !== 1) {
      throw new Error('PrivateProfile not found');
    }

    return updatedPrivateProfile[0];
  }

  public static async updatePrivateProfile(
    privateProfile: PrivateProfile,
    userID: number,
  ): Promise<PrivateProfile> {
    const query = PrivateProfile.query()
      .update(privateProfile)
      .where('userID', userID);

    const recollectQuery = PrivateProfile.query().where('userID', userID);

    const updatedPrivateProfile = await recollectQuery;
    if (!updatedPrivateProfile) {
      throw new Error('PrivateProfile not found');
    }

    if (updatedPrivateProfile.length !== 1) {
      throw new Error('PrivateProfile not found');
    }

    return updatedPrivateProfile[0];
  }
}
