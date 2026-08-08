import React, { useMemo } from 'react';
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/mui';
import User from 'backend/models/user/user';
import Snackbar from '@mui/material/Snackbar';
import { useRecoilState } from 'recoil';

import { UserState } from '../state/store';
import { getFrontendConfig } from '../config/config';
import BackendUserClient from '../api/users/client';

const frontendConfig = getFrontendConfig();

function MyProfileForm() {
  const [userState, setUserState] = useRecoilState(UserState);
  const [open, setOpen] = React.useState(false);
  const userClient = useMemo(
    () => new BackendUserClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
  );
  const formData = useMemo(
    () => ({
      ...userState,
      skillsOfNote: userState.skillsOfNote ?? [],
    }),
    [userState],
  );

  const handleClose = (
    event: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = async (data: any) => {
    const { formData: submittedFormData } = data as { formData: User };
    submittedFormData.skillsOfNote = submittedFormData.skillsOfNote || [];

    const updatedUser = await userClient.UpdateUser(submittedFormData);
    setUserState(updatedUser);
    setOpen(true);
  };

  return (
    <>
      <Form
        schema={User.formSchema}
        validator={validator}
        onSubmit={handleSubmit}
        formData={formData}
        uiSchema={User.formUiSchema}
      />
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message="Profile Updated!"
      />
    </>
  );
}

export default MyProfileForm;
