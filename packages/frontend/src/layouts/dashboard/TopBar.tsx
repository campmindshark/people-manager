import React, { useCallback } from 'react';
import {
  Avatar,
  Badge,
  Box,
  IconButton,
  Popper,
  Typography,
  Toolbar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useRecoilValue } from 'recoil';
import { signupStatusIssues } from 'backend/view_models/signup_status';
import { getFrontendConfig } from '../../config/config';
import AppBar from './AppBar';
import PageState, {
  UserState,
  CurrentUserSignupStatus,
} from '../../state/store';

const frontendConfig = getFrontendConfig();

interface TopBarProps {
  open: boolean;
  toggleDrawer: () => void;
}

export default function TopBar({ open, toggleDrawer }: TopBarProps) {
  const pageState = useRecoilValue(PageState);
  const appUser = useRecoilValue(UserState);
  const signupStatus = useRecoilValue(CurrentUserSignupStatus);
  const issues = signupStatusIssues(signupStatus);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const popperOpen = Boolean(anchorEl);
  const id = popperOpen ? 'simple-popper' : undefined;

  const handlePopperOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    },
    [setAnchorEl],
  );

  const handlePopperClose = useCallback(() => {
    setAnchorEl(null);
  }, [setAnchorEl]);

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
        <IconButton color="inherit" onClick={handlePopperOpen}>
          <Badge badgeContent={issues.length} color="secondary">
            <NotificationsIcon />
          </Badge>
        </IconButton>
        <IconButton color="inherit" onClick={handleLogout}>
          <LogoutIcon />
        </IconButton>
      </Toolbar>
      <Popper
        id={id}
        open={popperOpen}
        anchorEl={anchorEl}
        onMouseEnter={handlePopperClose}
        sx={{ zIndex: 9999 }}
      >
        <Box sx={{ border: 1, p: 1, bgcolor: 'background.paper' }}>
          {issues.map((issue) => (
            <Typography key={issue}>{issue}</Typography>
          ))}
        </Box>
      </Popper>
    </AppBar>
  );
}
