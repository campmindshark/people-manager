import React from 'react';
import {
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';

function VerifyUsersTable() {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableCell component="th" scope="row">
            user
          </TableCell>
          <TableCell component="th" scope="row">
            {true ? (
              <ThumbUpIcon color="success" />
            ) : (
              <ThumbDownIcon color="error" />
            )}
          </TableCell>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default VerifyUsersTable;
