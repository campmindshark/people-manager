import * as React from 'react';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import HomeIcon from '@mui/icons-material/Home';
import CelebrationIcon from '@mui/icons-material/Celebration';
import SettingsIcon from '@mui/icons-material/Settings';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import PageState from '../../state/store';

export default function NavList() {
  const pageState = useRecoilValue(PageState);

  return (
    <List component="nav">
      <ListItemButton
        component={Link}
        to="/"
        selected={pageState.index === 'home'}
      >
        <ListItemIcon>
          <HomeIcon />
        </ListItemIcon>
        <ListItemText primary="Home" />
      </ListItemButton>
      <ListItemButton
        component={Link}
        to="/shifts"
        selected={pageState.index === 'shifts'}
      >
        <ListItemIcon>
          <CelebrationIcon />
        </ListItemIcon>
        <ListItemText primary="Shifts" />
      </ListItemButton>
      <Divider sx={{ my: 1 }} />
      <>
        <ListSubheader component="div" inset>
          Utilities
        </ListSubheader>
        <ListItemButton
          component={Link}
          to="/settings"
          selected={pageState.index === 'settings'}
        >
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
      </>
    </List>
  );
}
