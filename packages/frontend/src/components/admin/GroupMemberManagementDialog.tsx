import React, { useEffect, useMemo, useState } from 'react';
import { useRecoilValue_TRANSITION_SUPPORT_UNSTABLE } from 'recoil';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Group from 'backend/models/group/group';
import User from 'backend/models/user/user';
import BackendGroupClient from 'src/api/groups/groups';
import { getFrontendConfig } from 'src/config/config';
import { AllUsers } from 'src/state/users';

const frontendConfig = getFrontendConfig();

interface Props {
  group: Group;
  open: boolean;
  handleClose: () => void;
  handleSuccess: () => void;
}

function GroupMembershipManagementDialog(props: Props) {
  const { group, open, handleClose, handleSuccess } = props;
  const allUsers = useRecoilValue_TRANSITION_SUPPORT_UNSTABLE(AllUsers);
  const [members, setMembers] = useState<User[]>([]);
  const [newMemberString, setNewMemberString] = useState<string>('');
  const [reloadCounter, setReloadCounter] = useState(0);

  const potentialNewMembers = useMemo(
    () => allUsers.filter((user) => !members.includes(user)),
    [allUsers, members, reloadCounter],
  );

  console.log('allUsers', allUsers);
  console.log('members', members);
  console.log('potentialNewMembers', potentialNewMembers);

  const groupClient = useMemo(
    () => new BackendGroupClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
  );

  const handleSubmit = async () => {
    if (!group.id || !newMemberString) {
      return;
    }

    const userID = parseInt(
      newMemberString.match(/\[(\d+)\]/)?.[1] ?? '-1',
      10,
    );

    await groupClient.AddGroupMember(group.id, userID);
    setReloadCounter(reloadCounter + 1);
    handleSuccess();
  };

  const handleRemove = async (userID: number) => {
    if (!group.id) {
      return;
    }

    await groupClient.RemoveGroupMember(group.id, userID);
    setReloadCounter(reloadCounter + 1);
    handleSuccess();
  };

  useEffect(() => {
    console.log('fetching members');
    console.log(group);
    const fetchMembers = async () => {
      const membersData = await groupClient.GetGroupMembers(group.id);
      setMembers(membersData);
    };

    if (group.id) {
      fetchMembers();
    }
  }, [group.id, reloadCounter]);

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="lg">
      <DialogTitle>
        <Typography variant="h4">Manage {group.name} Members</Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 400 }}>
        <List>
          {members.map((member) => (
            <ListItem
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleRemove(member.id)}
                >
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText
                primary={`${member.firstName} ${member.lastName}`}
                secondary={member.email}
              />
            </ListItem>
          ))}
          <ListItem>
            <Autocomplete
              value={newMemberString}
              onChange={(event, newValue) => {
                setNewMemberString(newValue ?? '');
              }}
              disablePortal
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              id="new-user"
              options={potentialNewMembers.map(
                (user) =>
                  `[${user.id}] ${user.firstName} ${user.lastName} - (${user.email})`,
              )}
              sx={{ minWidth: 300 }}
              renderInput={(params) => (
                <TextField
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...params}
                  label="New Member"
                  variant="standard"
                />
              )}
            />
            <IconButton edge="end" aria-label="delete" onClick={handleSubmit}>
              <AddIcon />
            </IconButton>
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

export default GroupMembershipManagementDialog;
