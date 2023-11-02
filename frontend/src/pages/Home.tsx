import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import User from '../../../user/user';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState, { UsersState } from './store';

function Home() {
  const setPageState = useSetRecoilState(PageState);
  const users = useRecoilValue(UsersState);

  useEffect(() => {
    setPageState({
      title: 'Home',
      index: 'home',
    });
  });

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
                height: 240,
              }}
            >
              {/* <Chart /> */}
              <h1>Current Roster</h1>
              <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">ID</TableCell>
                    <TableCell align="right">GoogleID</TableCell>
                    <TableCell align="center">Name</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow
                      key={user.id}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        {user.googleID}
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {user.firstName}
                        {' '}
                        {user.lastName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

            </Paper>
          </Grid>
          {/* Recent Deposits */}
          <Grid item xs={12} md={4} lg={3}>
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                height: 240,
              }}
            >
              <h1>Teams</h1>
              {/* <Deposits /> */}
            </Paper>
          </Grid>
          {/* Recent Orders */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
              <h1>Chores</h1>
              {/* <Orders /> */}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Dashboard>

  );
}

export default Home;
