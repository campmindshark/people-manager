import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '@mui/material';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, {
  UserIsSignedUpForCurrentRoster,
  CurrentUserIsVerified,
} from '../state/store';
import RosterTable from '../components/RosterTable';
import RosterSignupDialog from '../components/RosterSignupDialog';
import RosterDropoutDialog from '../components/RosterDropoutDialog';
import RosterStats from '../components/RosterStats';

function Roster() {
  const setPageState = useSetRecoilState(PageState);
  const appUserIsSignedUpForCurrentBurn = useRecoilValue(
    UserIsSignedUpForCurrentRoster,
  );
  const userIsVerified = useRecoilValue(CurrentUserIsVerified);
  const [rosterEditFormOpen, setRosterEditFormOpen] = useState(false);
  const [rosterDropoutFormOpen, setRosterDropoutFormOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'MindShark Portal - Roster';
    setPageState({
      title: 'Roster',
      index: 'roster',
    });
  }, []);

  return (
    <Dashboard>
      <Container maxWidth={false} sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={1}>
          {appUserIsSignedUpForCurrentBurn ? (
            <>
              <Grid item xs={12} sx={{ marginBottom: '20px' }}>
                <RosterStats />
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={1}>
                  <Grid item>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => setRosterEditFormOpen(true)}
                    >
                      Edit your Roster submission
                    </Button>
                    <RosterSignupDialog
                      open={rosterEditFormOpen}
                      handleClose={() => setRosterEditFormOpen(false)}
                      handleSuccess={() => navigate(0)}
                      loadCurrentUserRosterData
                    />
                  </Grid>
                  <Grid item>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={() => setRosterDropoutFormOpen(true)}
                    >
                      Leave Roster
                    </Button>
                    <RosterDropoutDialog
                      open={rosterDropoutFormOpen}
                      handleClose={() => setRosterDropoutFormOpen(false)}
                      handleSuccess={() => navigate(0)}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </>
          ) : null}
          <Grid item>
            {userIsVerified ? (
              <RosterTable />
            ) : (
              <h1>
                You cannot view the roster until you are verified. Please email
                portal-support@campmindshark.com for verification.
              </h1>
            )}
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}

export default Roster;
