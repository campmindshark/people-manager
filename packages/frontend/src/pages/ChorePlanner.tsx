import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useSetRecoilState } from 'recoil';
import ChorePlanBuilder from '../components/admin/ChorePlanBuilder';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';

export default function ChorePlanner() {
  const setPageState = useSetRecoilState(PageState);

  useEffect(() => {
    setPageState({
      title: 'Chore Planner',
      index: 'admin-chore-planner',
    });
  }, [setPageState]);

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" gutterBottom>
            Chore plan draft
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Preview a deterministic plan from the current catalog, then save it
            as a draft. Applying a draft does not open signups or expose shifts
            to participants.
          </Typography>
          <ChorePlanBuilder />
        </Paper>
      </Container>
    </Dashboard>
  );
}
