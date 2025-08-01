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
  paymentDate?: string;
}

export interface DuesPaymentUpdate {
  paid: boolean;
  amount?: string;
  paymentMethod?: string;
  paymentDate?: string;
}

export interface DuesPayment {
  id: number;
  userID: number;
  rosterID: number;
  paid: boolean;
  amount?: string;
  paymentMethod?: string;
  paymentDate?: string;
}

export interface DuesClient {
  GetCurrentRosterParticipantsWithDues(): Promise<DuesParticipantInfo[]>;
  GetRosterParticipantsWithDues(rosterID: number): Promise<DuesParticipantInfo[]>;
  UpdateDuesPayment(userID: number, rosterID: number, payment: DuesPaymentUpdate): Promise<DuesPayment>;
}

export default class BackendDuesClient implements DuesClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetCurrentRosterParticipantsWithDues(): Promise<DuesParticipantInfo[]> {
    // This method is deprecated - use GetRosterParticipantsWithDues instead
    // For backwards compatibility, we'll assume roster ID 2 (current hardcoded value)
    return this.GetRosterParticipantsWithDues(2);
  }

  async GetRosterParticipantsWithDues(rosterID: number): Promise<DuesParticipantInfo[]> {
    const { data } = await axios.get<DuesParticipantInfo[]>(
      `${this.baseApiURL}/api/dues/participants/${rosterID}`,
      defaultRequestConfig,
    );
    return data;
  }

  async UpdateDuesPayment(userID: number, rosterID: number, payment: DuesPaymentUpdate): Promise<DuesPayment> {
    const { data } = await axios.put<DuesPayment>(
      `${this.baseApiURL}/api/dues/payment/${userID}`,
      { ...payment, rosterID },
      defaultRequestConfig,
    );
    return data;
  }
}
