import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

export const ShiftBlockOld = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: '40px',
}));

interface RootProps {
  timeFrameMinutes?: number;
}

export const ShiftBlock = styled(Paper, {
  shouldForwardProp: (prop) =>
    prop !== 'textColor' && prop !== 'buttonTextColor',
  name: 'MyThemeComponent',
  slot: 'Root',
})<RootProps>(({ theme, timeFrameMinutes }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(0.5),
  elevation: 2,
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: ((timeFrameMinutes ?? 60) / 60) * 40,
}));
