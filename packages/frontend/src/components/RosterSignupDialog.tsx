import React, { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import RosterSignupForm from './RosterSignupForm';
import { CurrentRosterParticipantsState } from '../state/roster';
import { UserState } from '../state/store';

interface Props {
  open: boolean;
  handleClose: () => void;
  loadCurrentUserRosterData: boolean;
}

function RosterSignupDialog(props: Props) {
  const { open, handleClose, loadCurrentUserRosterData } = props;
  const rosterParticipants = useRecoilValue(CurrentRosterParticipantsState);
  const userState = useRecoilValue(UserState);

  const thisRosterParticipant = useCallback(
    () =>
      rosterParticipants.find(
        (participant) => participant.user.id === userState.id,
      ),
    [rosterParticipants, userState],
  );

  const getFormData = useCallback((): RosterParticipant => {
    if (loadCurrentUserRosterData) {
      const participantViewModel = thisRosterParticipant();
      if (participantViewModel && participantViewModel.rosterParticipant) {
        console.log(participantViewModel.rosterParticipant);
        return participantViewModel.rosterParticipant;
      }

      console.log('No participant found');

      return new RosterParticipant();
    }
    return new RosterParticipant();
  }, [loadCurrentUserRosterData]);

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="lg">
      <DialogTitle>
        <Typography variant="h4">Roster Sign Up</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <RosterSignupForm rosterParticipant={getFormData()} />
      </DialogContent>
    </Dialog>
  );
}

export default RosterSignupDialog;
