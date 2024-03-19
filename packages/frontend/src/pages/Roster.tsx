import React, { useEffect, useState } from 'react';
import { Container } from '@mui/material';
import { useSetRecoilState } from 'recoil';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';
import RosterTable from '../components/RosterTable';
import RosterSignupDialog from '../components/RosterSignupDialog';

function Roster() {
  const setPageState = useSetRecoilState(PageState);
  const [rosterEditFormOpen, setRosterEditFormOpen] = useState(false);

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
        <Grid container spacing={1}>
          <Grid item>
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
                  loadCurrentUserRosterData
                />
              </Grid>
              <Grid item>
                <Button variant="contained" color="warning">
                  Leave Roster
                </Button>
              </Grid>
            </Grid>
          </Grid>
          <Grid item>
            <RosterTable />
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}

export default Roster;
