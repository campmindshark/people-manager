import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import RosterSignupForm from './RosterSignupForm';

interface Props {
  open: boolean;
  handleClose: () => void;
}

function RosterSignupDialog(props: Props) {
  const { open, handleClose } = props;
  return (
    <Dialog onClose={handleClose} open={open} maxWidth="lg">
      <DialogTitle>
        <Typography variant="h4">Roster Sign Up</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <RosterSignupForm rosterParticipant={new RosterParticipant()} />
      </DialogContent>
    </Dialog>
  );
}

export default RosterSignupDialog;
