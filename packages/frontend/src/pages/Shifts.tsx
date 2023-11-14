import React, { useEffect, useState } from 'react';
import Container from '@mui/material/Container';
import { useSetRecoilState } from 'recoil';
import ShiftDisplay from 'src/components/shifts/ShiftDisplay';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';

export default function Shifts() {
  const setPageState = useSetRecoilState(PageState);

  useEffect(() => {
    setPageState({
      title: 'Shifts',
      index: 'shifts',
    });
  });

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <ShiftDisplay />
      </Container>
    </Dashboard>
  );
}
