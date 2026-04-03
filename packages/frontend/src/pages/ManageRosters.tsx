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
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  SelectChangeEvent,
} from '@mui/material';
import Roster from 'backend/models/roster/roster';
import { useRecoilState, useSetRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';
import { ActiveRosterIDState } from '../state/roster';
import BackendRosterClient from '../api/roster/roster';
import BackendSettingsClient from '../api/settings/client';
import { getFrontendConfig } from '../config/config';

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);
const settingsClient = new BackendSettingsClient(frontendConfig.BackendURL);

const currentYear = new Date().getFullYear();

export default function ManageRosters() {
  const setPageState = useSetRecoilState(PageState);
  const [activeRosterID, setActiveRosterID] =
    useRecoilState(ActiveRosterIDState);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setPageState({
      title: 'Manage Rosters',
      index: 'admin-rosters',
    });
  });

  useEffect(() => {
    rosterClient.GetAllRosters().then(setRosters).catch(console.error);
  }, []);

  const currentYearRosterExists = rosters.some(
    (roster) => roster.year === currentYear,
  );

  const handleRosterChange = async (event: SelectChangeEvent<number>) => {
    const newRosterID = Number(event.target.value);
    try {
      await settingsClient.SetActiveRosterID(newRosterID);
      setActiveRosterID(newRosterID);
      setMessage({
        type: 'success',
        text: `Active roster changed to ID ${newRosterID}. Users will see this on their next page load.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to update active roster: ${error}`,
      });
    }
  };

  const handleCreateRoster = async () => {
    try {
      const newRoster = await rosterClient.CreateRoster(currentYear);
      setRosters((prev) =>
        [...prev, newRoster].sort((a, b) => a.year - b.year),
      );
      setMessage({
        type: 'success',
        text: `Created roster for ${currentYear} (ID: ${newRoster.id}).`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to create roster: ${error}`,
      });
    }
  };

  return (
    <Dashboard>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {message && (
            <Grid item xs={12}>
              <Alert severity={message.type} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Active Roster</h1>
              <Typography sx={{ mb: 2 }}>
                Changing this affects which roster all users see when they load
                the site.
              </Typography>
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
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Create Roster</h1>
              <Typography sx={{ mb: 2 }}>
                {currentYearRosterExists
                  ? `A roster for ${currentYear} already exists.`
                  : `Create a new roster for the current year (${currentYear}).`}
              </Typography>
              <Button
                variant="contained"
                onClick={handleCreateRoster}
                disabled={currentYearRosterExists}
                sx={{ alignSelf: 'flex-start' }}
              >
                Create {currentYear} Roster
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>All Rosters</h1>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Year</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rosters.map((roster) => (
                      <TableRow key={roster.id}>
                        <TableCell>{roster.id}</TableCell>
                        <TableCell>{roster.year}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}
