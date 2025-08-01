import axios from 'axios';
import defaultRequestConfig from '../common/requestConfig';

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

export interface DuesPaymentUpdate {
  paid: boolean;
  amount?: string;
  paymentMethod?: string;
  paymentDate?: Date;
}

export interface DuesPayment {
  id: number;
  userID: number;
  rosterID: number;
  paid: boolean;
  amount?: string;
  paymentMethod?: string;
  paymentDate?: Date;
}

export interface DuesClient {
  GetRosterParticipantsWithDues(rosterID: number): Promise<DuesParticipantInfo[]>;
  UpdateDuesPayment(userID: number, rosterID: number, payment: DuesPaymentUpdate): Promise<DuesPayment>;
}

export default class BackendDuesClient implements DuesClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }


  async GetRosterParticipantsWithDues(rosterID: number): Promise<DuesParticipantInfo[]> {
    const { data } = await axios.get<DuesParticipantInfo[]>(
      `${this.baseApiURL}/api/dues/participants/${rosterID}`,
      defaultRequestConfig,
    );
    // Convert ISO date strings to Date objects
    return data.map(participant => ({
      ...participant,
      paymentDate: participant.paymentDate ? new Date(participant.paymentDate) : undefined,
    }));
  }

  async UpdateDuesPayment(userID: number, rosterID: number, payment: DuesPaymentUpdate): Promise<DuesPayment> {
    // Convert Date object to ISO string for API
    const paymentForAPI = {
      ...payment,
      rosterID,
      paymentDate: payment.paymentDate ? payment.paymentDate.toISOString() : undefined,
    };
    
    const { data } = await axios.put<DuesPayment>(
      `${this.baseApiURL}/api/dues/payment/${userID}`,
      paymentForAPI,
      defaultRequestConfig,
    );
    // Convert ISO date string to Date object
    return {
      ...data,
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
    };
  }
}
