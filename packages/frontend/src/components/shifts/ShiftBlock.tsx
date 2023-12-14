import React from 'react';
import { useRecoilRefresher_UNSTABLE } from 'recoil';
import { Paper, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import ShiftViewModel, {
  shiftSignUpStatus,
  userIsSignedUpForShift,
} from 'backend/view_models/shift';
import CurrentRosterScheduleState from '../../state/schedules';
import ShiftDetailDialog from './ShiftDetailDialog';

interface RootProps {
  shiftViewModel?: ShiftViewModel;
  children?: React.ReactNode;
  timeFrameMinutes?: number;
  isEmptySlot?: boolean;
  currentUserID?: number;
}

const determineBackgroundColor = (
  themeMode: string,
  isEmptySlot: boolean,
  shiftViewModel?: ShiftViewModel,
) => {
  if (themeMode === 'dark') {
    if (isEmptySlot) {
      return '#1A2027';
    }

    if (!shiftViewModel) {
      return '#2D3748';
    }

    switch (shiftSignUpStatus(shiftViewModel)) {
      case 'understaffed':
        return '#F8961E';
      case 'staffed':
        return '#90BE6D';
      case 'overstaffed':
        return '#F94144';
      default:
        return '#2D3748';
    }
  }

  return isEmptySlot ? '#fff' : '#fff';
};

const determineBorderWidth = (
  currentUserID: number,
  shiftViewModel?: ShiftViewModel,
) => {
  if (shiftViewModel && userIsSignedUpForShift(shiftViewModel, currentUserID)) {
    return 4;
  }

  return 0;
};

const StyledShiftBlock = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== 'textColor' && prop !== 'buttonTextColor',
  name: 'MyThemeComponent',
  slot: 'Root',
})<RootProps>(
  ({
    theme,
    timeFrameMinutes,
    isEmptySlot,
    shiftViewModel,
    currentUserID,
  }) => ({
    backgroundColor: determineBackgroundColor(
      theme.palette.mode,
      isEmptySlot ?? false,
      shiftViewModel,
    ),
    ...theme.typography.body2,
    padding: theme.spacing(0.5),
    elevation: 2,
    textAlign: 'center',
    color: theme.palette.text.secondary,
    width: '100%',
    borderColor: '#F94144',
    borderStyle: 'solid',
    borderWidth: determineBorderWidth(currentUserID ?? 0, shiftViewModel),
    height: ((timeFrameMinutes ?? 60) / 60) * 40,
  }),
);

const StyledIconButton = styled(IconButton)({
  borderRadius: 0,
  padding: 0,
  margin: 0,
});

function ShiftBlock(props: RootProps) {
  const {
    children,
    timeFrameMinutes,
    isEmptySlot,
    shiftViewModel,
    currentUserID,
  } = props;
  const [dialogIsOpen, setDialogIsOpen] = React.useState(false);
  const refreshSchedules = useRecoilRefresher_UNSTABLE(
    CurrentRosterScheduleState,
  );

  const handleClose = () => {
    setDialogIsOpen(false);
    refreshSchedules();
  };

  const handleClick = () => {
    console.log('click');
    setDialogIsOpen(!dialogIsOpen);
  };

  return (
    <StyledIconButton onClick={handleClick}>
      <StyledShiftBlock
        shiftViewModel={shiftViewModel}
        timeFrameMinutes={timeFrameMinutes}
        isEmptySlot={isEmptySlot}
        currentUserID={currentUserID}
      >
        {children}
        {shiftViewModel && (
          <ShiftDetailDialog
            shiftViewModel={shiftViewModel}
            isOpen={dialogIsOpen}
            handleClose={handleClose}
          />
        )}
      </StyledShiftBlock>
    </StyledIconButton>
  );
}

ShiftBlock.defaultProps = {
  children: undefined,
  timeFrameMinutes: 60,
  isEmptySlot: false,
  shiftViewModel: undefined,
  currentUserID: undefined,
};

export default ShiftBlock;
