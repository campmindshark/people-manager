import React, { useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  Typography,
} from '@mui/material';
import BackendRosterClient from '../api/roster/roster';
import { getFrontendConfig } from '../config/config';
import { CurrentRosterState } from '../state/roster';

const frontendConfig = getFrontendConfig();

interface Props {
  open: boolean;
  handleClose: () => void;
  handleSuccess: () => void;
}

function RosterDropoutDialog(props: Props) {
  const { open, handleClose, handleSuccess } = props;
  const rosterState = useRecoilValue(CurrentRosterState);

  const rosterClient = useMemo(
    () => new BackendRosterClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
  );

  const handleDropout = useCallback(async () => {
    console.log('Dropout from roster id', rosterState.id);
    await rosterClient.DropOut(rosterState.id);
    console.log('handleSuccess');
    handleSuccess();
    handleClose();
  }, []);

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="lg">
      <DialogTitle>
        <Typography variant="h4">Roster Drop Out</Typography>
      </DialogTitle>
      <DialogContent dividers>
        Are you sure you want to drop out of this years burn?
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="error">
          No. I want to worship at the eternal flame of Mindshark.
        </Button>
        <Button onClick={handleDropout} color="primary">
          Yes. I hate this camp.
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RosterDropoutDialog;
