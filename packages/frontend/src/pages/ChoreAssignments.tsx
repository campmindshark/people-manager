import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useSetRecoilState } from 'recoil';
import ChorePlanAssignmentManager from '../components/admin/ChorePlanAssignmentManager';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';

export default function ChoreAssignments() {
  const setPageState = useSetRecoilState(PageState);

  useEffect(() => {
    setPageState({
      title: 'Chore Assignments',
      index: 'admin-chore-assignments',
    });
  }, [setPageState]);

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" gutterBottom>
            Administrative chore assignments
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Assign, unassign, move, or swap roster participants. The backend
            validates the complete proposed state; force overrides require a
            separate permission and an audited reason.
          </Typography>
          <ChorePlanAssignmentManager />
        </Paper>
      </Container>
    </Dashboard>
  );
}
