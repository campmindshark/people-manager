import React from 'react';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useRecoilValue } from 'recoil';
import { signupStatusIssues } from 'backend/view_models/signup_status';
import { CurrentUserSignupStatus } from '../state/store';

function SignupIssues() {
  const signupStatus = useRecoilValue(CurrentUserSignupStatus);
  const issues = signupStatusIssues(signupStatus);

  if (issues.length > 0) {
    return (
      <Alert severity="error" sx={{ marginBottom: '20px' }}>
        <Typography gutterBottom component="div">
          You have the following issues:
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Typography>
      </Alert>
    );
  }

  return null;
}

export default SignupIssues;
