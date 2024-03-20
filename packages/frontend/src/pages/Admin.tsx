import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, { MyRolesState } from '../state/store';
import { CurrentRosterParticipantsSignupStatusState } from '../state/roster';

export default function Admin() {
  const setPageState = useSetRecoilState(PageState);
  const myRoles = useRecoilValue(MyRolesState);
  const signupStatuses = useRecoilValue(
    CurrentRosterParticipantsSignupStatusState,
  );

  const generateIcon = (status: boolean) => {
    if (status) {
      return <ThumbUpIcon color="success" />;
    }
    return <ThumbDownIcon color="error" />;
  };

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
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Participant</TableCell>
                    <TableCell>Public Profile</TableCell>
                    <TableCell>Private Profile</TableCell>
                    <TableCell>Paid Dues</TableCell>
                    <TableCell>Shift Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {signupStatuses.map((status) => (
                    <TableRow key={status.user.id}>
                      <TableCell>
                        {status.user.firstName} {status.user.lastName}
                      </TableCell>
                      <TableCell>
                        {generateIcon(status.hasCompletedPublicProfile)}
                      </TableCell>
                      <TableCell>
                        {generateIcon(status.hasCompletedPrivateProfile)}
                      </TableCell>
                      <TableCell>{generateIcon(status.hasPaidDues)}</TableCell>
                      <TableCell>{status.shiftCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Dashboard>
  );
}
