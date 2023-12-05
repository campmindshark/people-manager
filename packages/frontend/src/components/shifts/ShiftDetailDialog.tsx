import React from 'react';
import { useRecoilValue } from 'recoil';
import User from 'backend/models/user/user';
import ShiftViewModel, {
  userIsSignedUpForShift,
  shiftSignupStatus,
} from 'backend/view_models/shift';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  DialogActions,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import BurningManDateFormatter from '../../utils/datetime/formatter';
import { UserState } from '../../state/store';

interface Props {
  shiftViewModel: ShiftViewModel;
  isOpen: boolean;
  handleClose: () => void;
}

export default function ShiftDetailDialog(props: Props) {
  const { shiftViewModel, isOpen, handleClose } = props;
  const appUser = useRecoilValue(UserState);

  const handleShiftSignup = () => {
    console.log('signup');
  };

  const generateParticipantList = () => {
    const participantList: JSX.Element[] = [];
    for (
      let index = 0;
      index < shiftViewModel.shift.requiredParticipants;
      index += 1
    ) {
      if (shiftViewModel.participants[index]) {
        const participantUser = User.fromJson(
          shiftViewModel.participants[index],
        );
        participantList.push(
          <ListItem disablePadding key={index}>
            <ListItemIcon>
              <PersonIcon />
            </ListItemIcon>
            {participantUser.displayName()}
          </ListItem>,
        );
      } else {
        participantList.push(
          <ListItem disablePadding key={index}>
            <ListItemIcon>
              <PersonIcon />
            </ListItemIcon>
            Available Slot
          </ListItem>,
        );
      }
    }
    return participantList;
  };

  const generateCallToAction = () => {
    const isSignedUpForThisShift = userIsSignedUpForShift(
      shiftViewModel,
      appUser.id,
    );
    if (isSignedUpForThisShift) {
      return (
        <Button autoFocus variant="contained" onClick={handleShiftSignup}>
          Unsignup For Shift
        </Button>
      );
    }

    const signupStatus = shiftSignupStatus(shiftViewModel);
    switch (signupStatus) {
      case 'understaffed':
        return (
          <Button autoFocus variant="contained" onClick={handleShiftSignup}>
            Signup For Shift
          </Button>
        );
      case 'staffed':
        return <Typography>This shift is full</Typography>;
      case 'overstaffed':
        return (
          <Typography>
            There are more people signed up than there are required for this
            shift. Please contact an admin to get this handled.
          </Typography>
        );
      default:
        return (
          <Typography>
            Something went wrong... Please contact an Admin.
          </Typography>
        );
    }
  };

  return (
    <Dialog onClose={handleClose} open={isOpen}>
      <DialogTitle>
        <Typography variant="h4">
          {shiftViewModel.scheduleName} Shift Details
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Shift Details
        </Typography>
        <Typography variant="body1">
          <strong>Start:</strong>{' '}
          {BurningManDateFormatter.format(shiftViewModel.shift.startTime)}
        </Typography>
        <Typography variant="body1">
          <strong>End:</strong>{' '}
          {BurningManDateFormatter.format(shiftViewModel.shift.endTime)}
        </Typography>
        <br />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Participants
        </Typography>
        <List>{generateParticipantList()}</List>
      </DialogContent>
      <DialogActions>{generateCallToAction()}</DialogActions>
    </Dialog>
  );
}
