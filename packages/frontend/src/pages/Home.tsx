import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Container,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, {
  UserState,
  UserIsSignedUpForCurrentRoster,
} from '../state/store';
import { GetFrontendConfig } from '../config/config';
import MyShiftsTable from '../components/MyShiftsTable';
import RosterTable from '../components/RosterTable';
import { CurrentRosterState } from '../state/roster';
import BackendRosterClient from '../api/roster/roster';

const frontendConfig = GetFrontendConfig();

function Home() {
  const setPageState = useSetRecoilState(PageState);
  const appUser = useRecoilValue(UserState);
  const currentRoster = useRecoilValue(CurrentRosterState);
  const appUserIsSignedUpForCurrentBurn = useRecoilValue(
    UserIsSignedUpForCurrentRoster,
  );

  const rosterClient = useMemo(
    () => new BackendRosterClient(frontendConfig.BackendURL),
    [],
  );

  const signUserUp = useCallback(() => {
    console.log('signupUser');
  }, []);

  useEffect(() => {
    document.title = 'MindShark Portal - Home';
    setPageState({
      title: 'Home',
      index: 'home',
    });
  }, []);

  const rosterSignupCTA = () => {
    if (!appUserIsSignedUpForCurrentBurn) {
      return (
        <Alert severity="warning" variant="filled">
          <AlertTitle>
            <Typography variant="h5">You are not signed up</Typography>
          </AlertTitle>
          <Typography>
            Warning! You ({appUser.firstName} {appUser.lastName}) may be missing
            out on the {currentRoster.year} burn.
          </Typography>
          <br />
          <Button variant="contained" color="error" onClick={signUserUp}>
            Click here to sign up for Burning Man {currentRoster.year}!
          </Button>
        </Alert>
      );
    }

    return <p>See you at the burn. :)</p>;
  };

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* Chart */}
          <Grid item xs={12} md={8} lg={9}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              {/* <Chart /> */}
              <h1>Current Roster</h1>
              {rosterSignupCTA()}
              <RosterTable />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4} lg={3}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <h1>Teams</h1>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <MyShiftsTable />
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}

export default Home;
