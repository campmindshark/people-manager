import React, { useState } from 'react';
import {
  Button,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Toolbar,
  Typography,
  Grid,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import {
  useRecoilValue_TRANSITION_SUPPORT_UNSTABLE,
  useRecoilRefresher_UNSTABLE,
} from 'recoil';
import GroupViewModel from 'backend/view_models/group';
import GroupsState from '../../state/groups';
import CreateGroupDialog from './CreateGroupDialog';

const generateTableRow = (group: GroupViewModel) => (
  <TableRow
    key={group.group.id}
    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
  >
    <TableCell component="th" scope="row">
      {group.group.name}
    </TableCell>
    <TableCell component="th" scope="row">
      {group.group.description}
    </TableCell>
    <TableCell component="th" scope="row">
      {new Date(group.group.shiftSignupOpenDate).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
      })}
    </TableCell>
    <TableCell component="th" scope="row">
      {group.members.map((member) => `${member.firstName} ${member.lastName}`)}
    </TableCell>
    <TableCell component="th" scope="row">
      <IconButton>
        <EditIcon />
      </IconButton>
      <IconButton>
        <PeopleIcon />
      </IconButton>
    </TableCell>
  </TableRow>
);

function GroupManagementTable() {
  const groups = useRecoilValue_TRANSITION_SUPPORT_UNSTABLE(GroupsState);
  const updateGroups = useRecoilRefresher_UNSTABLE(GroupsState);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false);
    console.log('Group created');
    updateGroups();
  };

  return (
    <>
      <Toolbar>
        <Grid container direction="row-reverse" alignItems="right">
          <Grid item>
            <Typography variant="h6" id="tableTitle" component="div">
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setCreateDialogOpen(true);
                }}
              >
                Add Group
              </Button>
              <CreateGroupDialog
                open={createDialogOpen}
                handleClose={() => setCreateDialogOpen(false)}
                handleSuccess={handleCreateSuccess}
              />
            </Typography>
          </Grid>
        </Grid>
      </Toolbar>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} size="small" aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Signup Time</TableCell>
              <TableCell>Members</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => generateTableRow(group))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export default GroupManagementTable;
