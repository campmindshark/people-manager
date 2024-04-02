import React, { useCallback, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Container,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, {
  UserState,
  UserIsSignedUpForCurrentRoster,
} from '../state/store';
import MyShiftsTable from '../components/MyShiftsTable';
import { CurrentRosterState } from '../state/roster';
import UserStatusTable from '../components/UserStatusTable';
import RosterSignupDialog from '../components/RosterSignupDialog';

function Home() {
  const [signupDialogIsOpen, setSignupDialogIsOpen] = React.useState(false);
  const setPageState = useSetRecoilState(PageState);
  const appUser = useRecoilValue(UserState);
  const currentRoster = useRecoilValue(CurrentRosterState);
  const appUserIsSignedUpForCurrentBurn = useRecoilValue(
    UserIsSignedUpForCurrentRoster,
  );

  const navigate = useNavigate();

  const openSignupForm = useCallback(async () => {
    setSignupDialogIsOpen(true);
  }, []);

  useEffect(() => {
    document.title = 'MindShark Portal - Home';
    setPageState({
      title: 'Home',
      index: 'home',
    });
  }, []);

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <h1>My {currentRoster.year} Roster Status</h1>
              {!appUserIsSignedUpForCurrentBurn ? (
                <Alert severity="warning" variant="filled">
                  <AlertTitle>
                    <Typography variant="h5">You are not signed up</Typography>
                  </AlertTitle>
                  <Typography>
                    Warning! You ({appUser.firstName} {appUser.lastName}) may be
                    missing out on the {currentRoster.year} burn.
                  </Typography>
                  <br />
                  <Button
                    variant="contained"
                    color="error"
                    onClick={openSignupForm}
                  >
                    Click here to sign up for Burning Man {currentRoster.year}!
                  </Button>
                  <RosterSignupDialog
                    open={signupDialogIsOpen}
                    handleClose={() => setSignupDialogIsOpen(false)}
                    handleSuccess={() => navigate(0)}
                    loadCurrentUserRosterData={false}
                  />
                </Alert>
              ) : (
                <UserStatusTable />
              )}
            </Paper>
          </Grid>
          {/* <Grid item xs={12} md={4} lg={3}>
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
          </Grid> */}
          <Grid item xs={12}>
            <MyShiftsTable />
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}

export default Home;
