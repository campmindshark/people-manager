import Knex from 'knex';
import knexConfig from '../knexfile';
import { getConfig } from '../config/config';
import DuesPayment from '../models/dues_payment/dues_payment';
import Roster from '../models/roster/roster';

const knex = Knex(knexConfig[getConfig().Environment]);

export interface DuesParticipantInfo {
  userID: number;
  rosterID: number;
  firstName: string;
  lastName: string;
  email: string;
  paid: boolean;
  amount?: string;
  paymentMethod?: string;
  paymentDate?: Date;
}

export default class DuesController {
  public static async getCurrentRoster(): Promise<Roster | null> {
    const roster = await Roster.query().orderBy('year', 'desc').first();
    return roster || null;
  }

  public static async getRosterParticipantsWithDues(
    rosterID: number,
  ): Promise<DuesParticipantInfo[]> {
    const participantsWithDues = await knex
      .select(
        'users.id as userID',
        'users.firstName',
        'users.lastName',
        'users.email',
        'roster_participants.rosterID',
        'dues_payments.paid',
        'dues_payments.amount',
        'dues_payments.paymentMethod',
        'dues_payments.paymentDate',
      )
      .from('roster_participants')
      .join('users', 'roster_participants.userID', 'users.id')
      .leftJoin('dues_payments', function join() {
        this.on(
          'dues_payments.userID',
          '=',
          'roster_participants.userID',
        ).andOn('dues_payments.rosterID', '=', 'roster_participants.rosterID');
      })
      .where('roster_participants.rosterID', rosterID)
      .orderBy('users.lastName', 'asc')
      .orderBy('users.firstName', 'asc');

    return participantsWithDues.map((row) => ({
      userID: row.userID,
      rosterID: row.rosterID,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      paid: row.paid || false,
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      paymentDate: row.paymentDate,
    }));
  }

  public static async updateDuesPayment(
    userID: number,
    rosterID: number,
    paid: boolean,
    amount?: string,
    paymentMethod?: string,
    paymentDate?: Date,
  ): Promise<DuesPayment> {
    const finalPaymentDate = paid ? paymentDate || new Date() : undefined;

    const existingPayment = await DuesPayment.query().findOne({
      userID,
      rosterID,
    });

    if (existingPayment) {
      return existingPayment.$query().patchAndFetch({
        paid,
        amount: paid ? amount : undefined,
        paymentMethod: paid ? paymentMethod : undefined,
        paymentDate: finalPaymentDate,
      });
    }

    return DuesPayment.query().insert({
      userID,
      rosterID,
      paid,
      amount: paid ? amount : undefined,
      paymentMethod: paid ? paymentMethod : undefined,
      paymentDate: finalPaymentDate,
    });
  }
}
