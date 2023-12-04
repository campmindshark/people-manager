import React from 'react';
import { Paper, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import ShiftViewModel from 'backend/view_models/shift';
import ShiftDetailDialog from './ShiftDetailDialog';

interface RootProps {
  shiftViewModel?: ShiftViewModel;
  children?: React.ReactNode;
  timeFrameMinutes?: number;
  isEmptySlot?: boolean;
}

const determineBackgroundColor = (themeMode: string, isEmptySlot: boolean) => {
  if (themeMode === 'dark') {
    return isEmptySlot ? '#1A2027' : '#2D3748';
  }
  return isEmptySlot ? '#fff' : '#fff';
};

const StyledShiftBlock = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== 'textColor' && prop !== 'buttonTextColor',
  name: 'MyThemeComponent',
  slot: 'Root',
})<RootProps>(({ theme, timeFrameMinutes, isEmptySlot }) => ({
  backgroundColor: determineBackgroundColor(
    theme.palette.mode,
    isEmptySlot ?? false,
  ),
  ...theme.typography.body2,
  padding: theme.spacing(0.5),
  elevation: 2,
  textAlign: 'center',
  color: theme.palette.text.secondary,
  width: '100%',
  height: ((timeFrameMinutes ?? 60) / 60) * 40,
}));

const StyledIconButton = styled(IconButton)({
  borderRadius: 0,
  padding: 0,
  margin: 0,
});

function ShiftBlock(props: RootProps) {
  const { children, timeFrameMinutes, isEmptySlot, shiftViewModel } = props;
  const [dialogIsOpen, setDialogIsOpen] = React.useState(false);

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
      >
        {children}
        {shiftViewModel && (
          <ShiftDetailDialog
            shiftViewModel={shiftViewModel}
            isOpen={dialogIsOpen}
            handleClose={handleClick}
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
};

export default ShiftBlock;
