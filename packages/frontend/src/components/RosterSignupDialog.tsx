import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';
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
        <RosterSignupForm />
      </DialogContent>
    </Dialog>
  );
}

export default RosterSignupDialog;
