import axios from 'axios';
import Shift from 'backend/models/shift/shift';
import ShiftViewModel from 'backend/view_models/shift';
import defaultRequestConfig from '../common/requestConfig';

export interface ShiftClient {
  GetAllShifts(): Promise<Shift[]>;
  GetShiftViewModelsBySchedule(scheduleID: number): Promise<ShiftViewModel[]>;
  GetShiftsByParticipantID(scheduleID: number): Promise<ShiftViewModel[]>;
  EditChoreSignup(
    addShiftIDs: number[],
    removeShiftIDs: number[],
  ): Promise<ChoreSignupEditResult>;
  ChangeShift(
    currentShiftID: number,
    replacementShiftID: number,
  ): Promise<ShiftChangeResult>;
  MoveParticipant(
    source: ShiftParticipantAssignment,
    destinationShiftID: number,
    force?: boolean,
  ): Promise<ShiftReassignmentResult>;
  SwapParticipants(
    assignments: ShiftParticipantAssignment[],
    force?: boolean,
  ): Promise<ShiftReassignmentResult>;
  UnassignParticipant(
    assignment: ShiftParticipantAssignment,
  ): Promise<ShiftUnassignmentResult>;
  AssignParticipant(
    assignment: ShiftParticipantAssignment,
  ): Promise<ShiftAssignmentResult>;
}

export interface ShiftSignupResult {
  registeredShiftIDs: number[];
}

export interface ShiftUnregisterResult {
  success: boolean;
}

export interface ChoreSignupEditResult {
  addedShiftIDs: number[];
  removedShiftIDs: number[];
}

export interface ShiftChangeResult {
  unregisteredShiftID: number;
  registeredShiftID: number;
}

export interface ShiftParticipantAssignment {
  shiftID: number;
  userID: number;
}

export interface ShiftParticipantReassignment {
  userID: number;
  sourceShiftID: number;
  destinationShiftID: number;
}

export interface ShiftReassignmentResult {
  reassignments: ShiftParticipantReassignment[];
  forced: boolean;
}

export interface ShiftUnassignmentResult {
  unassigned: ShiftParticipantAssignment;
}

export interface ShiftAssignmentResult {
  assigned: ShiftParticipantAssignment;
}

export default class BackendShiftClient implements ShiftClient {
  baseApiURL: string;

  constructor(baseApiURL: string) {
    this.baseApiURL = baseApiURL;
  }

  async GetAllShifts(): Promise<Shift[]> {
    const { data } = await axios.get<Shift[]>(
      `${this.baseApiURL}/api/shifts`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetShiftViewModelsBySchedule(
    scheduleID: number,
  ): Promise<ShiftViewModel[]> {
    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/schedules/${scheduleID}/shifts`,
      defaultRequestConfig,
    );
    return data;
  }

  async SignUpForShift(shiftID: number): Promise<ShiftSignupResult> {
    const { data } = await axios.post<ShiftSignupResult>(
      `${this.baseApiURL}/api/shifts/${shiftID}/signup`,
      {},
      defaultRequestConfig,
    );
    return data;
  }

  async EditChoreSignup(
    addShiftIDs: number[],
    removeShiftIDs: number[],
  ): Promise<ChoreSignupEditResult> {
    const { data } = await axios.patch<ChoreSignupEditResult>(
      `${this.baseApiURL}/api/shifts/chore-signup`,
      { addShiftIDs, removeShiftIDs },
      defaultRequestConfig,
    );
    return data;
  }

  async SignUpForShifts(shiftIDs: number[]): Promise<ShiftSignupResult> {
    const { data } = await axios.post<ShiftSignupResult>(
      `${this.baseApiURL}/api/shifts/signup`,
      { shiftIDs },
      defaultRequestConfig,
    );
    return data;
  }

  async ChangeShift(
    currentShiftID: number,
    replacementShiftID: number,
  ): Promise<ShiftChangeResult> {
    const { data } = await axios.post<ShiftChangeResult>(
      `${this.baseApiURL}/api/shifts/change`,
      { currentShiftID, replacementShiftID },
      defaultRequestConfig,
    );
    return data;
  }

  async MoveParticipant(
    source: ShiftParticipantAssignment,
    destinationShiftID: number,
    force = false,
  ): Promise<ShiftReassignmentResult> {
    const { data } = await axios.post<ShiftReassignmentResult>(
      `${this.baseApiURL}/api/shifts/reassign`,
      { source, destinationShiftID, force },
      defaultRequestConfig,
    );
    return data;
  }

  async SwapParticipants(
    assignments: ShiftParticipantAssignment[],
    force = false,
  ): Promise<ShiftReassignmentResult> {
    const { data } = await axios.post<ShiftReassignmentResult>(
      `${this.baseApiURL}/api/shifts/swap`,
      { assignments, force },
      defaultRequestConfig,
    );
    return data;
  }

  async UnassignParticipant(
    assignment: ShiftParticipantAssignment,
  ): Promise<ShiftUnassignmentResult> {
    const { data } = await axios.post<ShiftUnassignmentResult>(
      `${this.baseApiURL}/api/shifts/unassign`,
      { assignment },
      defaultRequestConfig,
    );
    return data;
  }

  async AssignParticipant(
    assignment: ShiftParticipantAssignment,
  ): Promise<ShiftAssignmentResult> {
    const { data } = await axios.post<ShiftAssignmentResult>(
      `${this.baseApiURL}/api/shifts/assign`,
      { assignment },
      defaultRequestConfig,
    );
    return data;
  }

  async UnregisterFromShift(shiftID: number): Promise<ShiftUnregisterResult> {
    const { data } = await axios.delete<ShiftUnregisterResult>(
      `${this.baseApiURL}/api/shifts/${shiftID}/signup`,
      defaultRequestConfig,
    );
    return data;
  }

  async GetShiftsByParticipantID(userID: number): Promise<ShiftViewModel[]> {
    if (!userID) {
      console.log('undefined userID, cannot query shifts by participantID');
      return [];
    }

    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/shifts/by_participantID/${userID}`,
      defaultRequestConfig,
    );

    return data;
  }

  async GetMyShifts(): Promise<ShiftViewModel[]> {
    const { data } = await axios.get<ShiftViewModel[]>(
      `${this.baseApiURL}/api/shifts/my-shifts`,
      defaultRequestConfig,
    );

    return data;
  }
}
