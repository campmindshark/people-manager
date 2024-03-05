import * as React from 'react';
import { Avatar, Badge, IconButton, Typography, Toolbar } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useRecoilValue } from 'recoil';
import { getFrontendConfig } from '../../config/config';
import AppBar from './AppBar';
import PageState, { UserState } from '../../state/store';

const frontendConfig = getFrontendConfig();

interface TopBarProps {
  open: boolean;
  toggleDrawer: () => void;
}

export default function TopBar({ open, toggleDrawer }: TopBarProps) {
  const pageState = useRecoilValue(PageState);
  const appUser = useRecoilValue(UserState);

  const handleLogout = () => {
    console.log('logout');
    window.location.href = `${frontendConfig.BackendURL}/api/auth/logout`;
  };

  return (
    <AppBar position="absolute" open={open}>
      <Toolbar
        sx={{
          pr: '24px', // keep right padding when drawer closed
        }}
      >
        <IconButton
          edge="start"
          color="inherit"
          aria-label="open drawer"
          onClick={toggleDrawer}
          sx={{
            marginRight: '36px',
            ...(open && { display: 'none' }),
          }}
        >
          <MenuIcon />
        </IconButton>
        <Typography
          component="h1"
          variant="h6"
          color="inherit"
          noWrap
          sx={{ flexGrow: 1 }}
        >
          {pageState.title}
        </Typography>
        <Avatar>
          {appUser.firstName[0]}
          {appUser.lastName[0]}
        </Avatar>
        <IconButton color="inherit">
          <Badge badgeContent={4} color="secondary">
            <NotificationsIcon />
          </Badge>
        </IconButton>
        <IconButton color="inherit" onClick={handleLogout}>
          <LogoutIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
