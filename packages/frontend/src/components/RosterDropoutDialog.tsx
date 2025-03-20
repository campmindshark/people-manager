import React, { useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Divider,
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
    await rosterClient.DropOut(rosterState.id);
    handleSuccess();
    handleClose();
  }, []);

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', py: 2 }}>
        <Typography variant="h4" align="center">
          ⚠️ Drop Out Confirmation ⚠️
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ mt: 2, p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" color="error" gutterBottom>
            Are you absolutely sure?
          </Typography>
          <Typography variant="body1">
            You are about to drop out of Burning Man {rosterState.year}. This
            action cannot be undone.
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary" align="center">
          Please confirm your decision below
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Button
          onClick={handleClose}
          variant="contained"
          color="primary"
          size="large"
          sx={{ px: 4 }}
        >
          Keep Me In The Camp
        </Button>
        <Button
          onClick={handleDropout}
          variant="outlined"
          color="error"
          size="large"
          sx={{ px: 4 }}
        >
          Yes, Drop Out
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RosterDropoutDialog;
