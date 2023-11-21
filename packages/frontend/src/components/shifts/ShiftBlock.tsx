import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

interface RootProps {
  timeFrameMinutes?: number;
  isEmptySlot?: boolean;
}

const determineBackgroundColor = (themeMode: string, isEmptySlot: boolean) => {
  if (themeMode === 'dark') {
    return isEmptySlot ? '#1A2027' : '#2D3748';
  }
  return isEmptySlot ? '#fff' : '#fff';
};

const ShiftBlock = styled(Paper, {
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
  height: ((timeFrameMinutes ?? 60) / 60) * 40,
}));

export default ShiftBlock;
