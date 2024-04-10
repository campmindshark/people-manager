import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { Typography } from '@mui/material';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, { MyRolesState } from '../state/store';
import AllParticipantUserSignupStateTable from '../components/AllParticipantUserSignupStateTable';
import VerifyUsersTable from '../components/VerifyUsersTable';

export default function Admin() {
  const setPageState = useSetRecoilState(PageState);
  const myRoles = useRecoilValue(MyRolesState);

  useEffect(() => {
    setPageState({
      title: 'Admin',
      index: 'admin',
    });
  });

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8} lg={9}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: 240,
              }}
            >
              <h1>Settings</h1>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4} lg={3}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: 240,
              }}
            >
              <h1>My Roles</h1>
              <ul>
                {myRoles.map((role) => (
                  <li key={role.id}>{role.name}</li>
                ))}
              </ul>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Signup State</h1>
              <AllParticipantUserSignupStateTable />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Verify Users</h1>
              <Typography>
                This section allows us to verify users that have not already
                been verified. Caution: Once a user is verified, they will be
                able to see other camp members sorta private information.
              </Typography>
              <br />
              <VerifyUsersTable />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}
