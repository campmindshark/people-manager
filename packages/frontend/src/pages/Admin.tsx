import React, { useEffect, useState } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import {
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  SelectChangeEvent,
} from '@mui/material';
import Roster from 'backend/models/roster/roster';
import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, { MyRolesState } from '../state/store';
import { ActiveRosterIDState } from '../state/roster';
import AllParticipantUserSignupStateTable from '../components/AllParticipantUserSignupStateTable';
import VerifyUsersTable from '../components/VerifyUsersTable';
import GroupManagementTable from '../components/admin/GroupManagementTable';
import RosterParticipantCSVDownloadBtn from '../components/admin/RosterParticipantCSVDownloadBtn';
import BackendRosterClient from '../api/roster/roster';
import BackendSettingsClient from '../api/settings/client';
import { getFrontendConfig } from '../config/config';

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const settingsClient = new BackendSettingsClient(frontendConfig.BackendURL);

export default function Admin() {
  const setPageState = useSetRecoilState(PageState);
  const myRoles = useRecoilValue(MyRolesState);
  const [activeRosterID, setActiveRosterID] =
    useRecoilState(ActiveRosterIDState);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [rosterMessage, setRosterMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setPageState({
      title: 'Admin',
      index: 'admin',
    });
  });

  useEffect(() => {
    rosterClient.GetAllRosters().then(setRosters).catch(console.error);
  }, []);

  const handleRosterChange = async (event: SelectChangeEvent<number>) => {
    const newRosterID = Number(event.target.value);
    try {
      await settingsClient.SetActiveRosterID(newRosterID);
      setActiveRosterID(newRosterID);
      setRosterMessage({
        type: 'success',
        text: `Active roster changed to ID ${newRosterID}. Users will see this on their next page load.`,
      });
    } catch (error) {
      setRosterMessage({
        type: 'error',
        text: `Failed to update active roster: ${error}`,
      });
    }
  };

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Active Roster</h1>
              <Typography sx={{ mb: 2 }}>
                Changing this affects which roster all users see when they load
                the site.
              </Typography>
              {rosterMessage && (
                <Alert
                  severity={rosterMessage.type}
                  sx={{ mb: 2 }}
                  onClose={() => setRosterMessage(null)}
                >
                  {rosterMessage.text}
                </Alert>
              )}
              <FormControl sx={{ minWidth: 200, maxWidth: 400 }}>
                <InputLabel id="active-roster-select-label">
                  Active Roster
                </InputLabel>
                <Select
                  labelId="active-roster-select-label"
                  value={activeRosterID}
                  label="Active Roster"
                  onChange={handleRosterChange}
                >
                  {rosters.map((roster) => (
                    <MenuItem key={roster.id} value={roster.id}>
                      {roster.year} (ID: {roster.id})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Paper>
          </Grid>
          <Grid item xs={12} md={8} lg={9}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: 240,
              }}
            >
              <h1>Tools</h1>
              <RosterParticipantCSVDownloadBtn />
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
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Groups</h1>
              <GroupManagementTable />
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}
