import React, { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import RosterSignupFormV2 from './RosterSignupFormV2';
import { CurrentRosterParticipantsState } from '../state/roster';
import { UserState } from '../state/store';

interface Props {
  open: boolean;
  handleClose: () => void;
  handleSuccess: () => void;
  loadCurrentUserRosterData: boolean;
}

function RosterSignupDialog(props: Props) {
  const { open, handleClose, handleSuccess, loadCurrentUserRosterData } = props;
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
        return participantViewModel.rosterParticipant;
      }

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
        <RosterSignupFormV2
          handleSuccess={handleSuccess}
          rosterParticipant={getFormData()}
        />
      </DialogContent>
    </Dialog>
  );
}

export default RosterSignupDialog;
