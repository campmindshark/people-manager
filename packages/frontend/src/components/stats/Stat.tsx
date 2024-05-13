import React, { LegacyRef } from 'react';
import { styled } from '@mui/material/styles';

export const StatRoot = styled('div', {
  name: 'MuiStat', // The component name
  slot: 'root', // The slot name
})(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(3, 4),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  letterSpacing: '-0.025em',
  fontWeight: 600,
}));

export const StatValue = styled('div', {
  name: 'MuiStat',
  slot: 'value',
})(({ theme }) => ({
  ...theme.typography.h3,
}));

export const StatUnit = styled('div', {
  name: 'MuiStat',
  slot: 'unit',
})(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.palette.text.secondary,
}));

type StatProps = {
  value: React.ReactNode;
  unit: React.ReactNode;
};

const Stat = React.forwardRef(
  (props: StatProps, ref: LegacyRef<HTMLDivElement> | undefined) => {
    const { value, unit } = props;

    return (
      <StatRoot ref={ref}>
        <StatValue>{value}</StatValue>
        <StatUnit>{unit}</StatUnit>
      </StatRoot>
    );
  },
);

export default Stat;
