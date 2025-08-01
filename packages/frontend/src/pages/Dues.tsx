import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { Typography } from '@mui/material';
import { useSetRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';
import DuesManagementTable from '../components/admin/DuesManagementTable';

export default function Dues() {
  const setPageState = useSetRecoilState(PageState);

  useEffect(() => {
    setPageState({
      title: 'Dues Management',
      index: 'dues',
    });
  });

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h4" gutterBottom>
                Dues Management
              </Typography>
              <Typography variant="body1" gutterBottom>
                Manage payment status for current roster participants. Toggle the paid status 
                and add payment details as needed.
              </Typography>
              <DuesManagementTable />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}