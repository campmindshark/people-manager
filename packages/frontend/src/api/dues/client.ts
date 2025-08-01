import axios from 'axios';
import defaultRequestConfig from '../common/requestConfig';

export interface DuesParticipantInfo {
  userID: number;
  rosterID: number;
  firstName: string;
  lastName: string;
  email: string;
  paid: boolean;
  amount?: number;
  paymentMethod?: string;
  paymentDate?: Date;
}

export interface DuesPaymentUpdate {
  paid: boolean;
  amount?: number;
  paymentMethod?: string;
}

export interface DuesPayment {
  id: number;
  userID: number;
  rosterID: number;
  paid: boolean;
  amount?: number;
  paymentMethod?: string;
  paymentDate?: Date;
}

export interface DuesClient {
  GetCurrentRosterParticipantsWithDues(): Promise<DuesParticipantInfo[]>;
  UpdateDuesPayment(userID: number, payment: DuesPaymentUpdate): Promise<DuesPayment>;
}

export default class BackendDuesClient implements DuesClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetCurrentRosterParticipantsWithDues(): Promise<DuesParticipantInfo[]> {
    const { data } = await axios.get<DuesParticipantInfo[]>(
      `${this.baseApiURL}/api/dues/participants`,
      defaultRequestConfig,
    );
    return data;
  }

  async UpdateDuesPayment(userID: number, payment: DuesPaymentUpdate): Promise<DuesPayment> {
    const { data } = await axios.put<DuesPayment>(
      `${this.baseApiURL}/api/dues/payment/${userID}`,
      payment,
      defaultRequestConfig,
    );
    return data;
  }
}
