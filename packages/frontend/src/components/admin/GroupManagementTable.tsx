import React, { useState } from 'react';
import {
  Button,
  IconButton,
  List,
  ListItem,
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
import { DateTime } from 'luxon';
import Group from 'backend/models/group/group';
import GroupViewModel from 'backend/view_models/group';
import GroupsState from '../../state/groups';
import CreateGroupDialog from './CreateGroupDialog';
import GroupMembershipManagementDialog from './GroupMemberManagementDialog';
import { utcDateToDateTimeInTimezone } from '../../utils/datetime/utils';

const generateTableRow = (
  group: GroupViewModel,
  handleMemberClick: () => void,
) => (
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
      {utcDateToDateTimeInTimezone(
        new Date(group.group.shiftSignupOpenDate),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ).toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY)}
    </TableCell>
    <TableCell component="th" scope="row">
      <List dense>
        {group.members.map((member) => (
          <ListItem>
            {member.firstName} {member.lastName}
          </ListItem>
        ))}
      </List>
    </TableCell>
    <TableCell component="th" scope="row">
      <IconButton>
        <EditIcon />
      </IconButton>
      <IconButton onClick={handleMemberClick}>
        <PeopleIcon />
      </IconButton>
    </TableCell>
  </TableRow>
);

function GroupManagementTable() {
  const groups = useRecoilValue_TRANSITION_SUPPORT_UNSTABLE(GroupsState);
  const updateGroups = useRecoilRefresher_UNSTABLE(GroupsState);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<Group>(Group.fromJson({}));
  const [membershipManagementDialogOpen, setMembershipManagementDialogOpen] =
    useState(false);

  const handleSuccess = () => {
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
                handleSuccess={handleSuccess}
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
              <TableCell>
                Signup Time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </TableCell>
              <TableCell>Members</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((group) => {
              const handleMemberClick = () => {
                setActiveGroup(group.group);
                setMembershipManagementDialogOpen(true);
              };
              return generateTableRow(group, handleMemberClick);
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <GroupMembershipManagementDialog
        open={membershipManagementDialogOpen}
        group={activeGroup}
        handleSuccess={handleSuccess}
        handleClose={() => setMembershipManagementDialogOpen(false)}
      />
    </>
  );
}

export default GroupManagementTable;
