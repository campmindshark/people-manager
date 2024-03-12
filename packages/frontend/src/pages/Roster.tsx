import React, { useEffect } from 'react';
import { Container } from '@mui/material';
import { useSetRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';
import RosterTable from '../components/RosterTable';

function Roster() {
  const setPageState = useSetRecoilState(PageState);

  useEffect(() => {
    document.title = 'MindShark Portal - Roster';
    setPageState({
      title: 'Roster',
      index: 'roster',
    });
  }, []);

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, width: '100%' }}>
        <RosterTable />
      </Container>
    </Dashboard>
  );
}

export default Roster;
