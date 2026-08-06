import React, { useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
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
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" component="h1" gutterBottom>
              Chore planner
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 900 }}>
              Turn the scored chore catalog into a blank, dated signup plan.
              Preview the mix first, then create the signup sheet when it is
              ready.
            </Typography>
          </Box>
          <ChorePlanBuilder />
        </Stack>
      </Container>
    </Dashboard>
  );
}
