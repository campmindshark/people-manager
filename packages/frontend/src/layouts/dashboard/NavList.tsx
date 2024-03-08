import * as React from 'react';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import BackupTableIcon from '@mui/icons-material/BackupTable';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import HomeIcon from '@mui/icons-material/Home';
import CelebrationIcon from '@mui/icons-material/Celebration';
import SettingsIcon from '@mui/icons-material/Settings';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import PageState, { MyRolesState } from '../../state/store';

interface MenuItemLinkData {
  text: string;
  index: string;
  icon: React.ReactNode;
  path: string;
  needsRole: string[];
}

const mainLinks: MenuItemLinkData[] = [
  {
    text: 'Home',
    index: 'home',
    icon: <HomeIcon />,
    path: '/',
    needsRole: [],
  },
  {
    text: 'Shifts',
    index: 'shifts',
    icon: <CelebrationIcon />,
    path: '/shifts',
    needsRole: [],
  },
  {
    text: 'Roster',
    index: 'roser',
    icon: <BackupTableIcon />,
    path: '/roster',
    needsRole: [],
  },
];

const utilityLinks: MenuItemLinkData[] = [
  {
    text: 'Admin',
    index: 'admin',
    icon: <SupervisorAccountIcon />,
    path: '/admin',
    needsRole: ['admin'],
  },
  {
    text: 'Settings',
    index: 'settings',
    icon: <SettingsIcon />,
    path: '/settings',
    needsRole: [],
  },
];

export default function NavList() {
  const pageState = useRecoilValue(PageState);
  const myRoles = useRecoilValue(MyRolesState);

  const isUserAllowed = (link: MenuItemLinkData) => {
    if (link.needsRole.length === 0) {
      return true;
    }
    return myRoles.find((role) => link.needsRole.includes(role.name));
  };

  const generateLinks = (links: MenuItemLinkData[]) =>
    links.map((link) => {
      if (isUserAllowed(link)) {
        return (
          <ListItemButton
            key={link.index}
            component={Link}
            to={link.path}
            selected={pageState.index === link.index}
          >
            <ListItemIcon>{link.icon}</ListItemIcon>
            <ListItemText primary={link.text} />
          </ListItemButton>
        );
      }
      return null;
    });

  const generateMainLinks = () => generateLinks(mainLinks);

  const generateUtilityLinks = () => generateLinks(utilityLinks);

  return (
    <List component="nav">
      {generateMainLinks()}
      <Divider sx={{ my: 1 }} />
      <>
        <ListSubheader component="div" inset>
          Utilities
        </ListSubheader>
        {generateUtilityLinks()}
      </>
    </List>
  );
}
