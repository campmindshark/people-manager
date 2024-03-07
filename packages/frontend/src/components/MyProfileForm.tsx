import React, { useMemo } from 'react';
import validator from '@rjsf/validator-ajv8';
import { UiSchema } from '@rjsf/utils';
import Form from '@rjsf/mui';
import User from 'backend/models/user/user';
import Snackbar from '@mui/material/Snackbar';
import { useRecoilState } from 'recoil';

import { UserState } from '../state/store';
import { getFrontendConfig } from '../config/config';
import BackendUserClient from '../api/users/client';

const frontendConfig = getFrontendConfig();

const uiSchema: UiSchema = {
  'ui:widget': 'checkboxes',
  'ui:options': {
    inline: true,
  },
  'ui:emptyValue': [],
};

function MyProfileForm() {
  const [userState, setUserState] = useRecoilState(UserState);
  const [open, setOpen] = React.useState(false);
  const userClient = useMemo(
    () => new BackendUserClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
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

  const handleSubmit = async (data: any) => {
    console.log(data);

    const { formData } = data as { formData: User };
    formData.skillsOfNote = formData.skillsOfNote || [];

    const updatedUser = await userClient.UpdateUser(formData);
    setUserState(updatedUser);
    setOpen(true);
  };
  console.log(userState);

  return (
    <>
      <Form
        schema={User.formSchema}
        validator={validator}
        onSubmit={handleSubmit}
        formData={userState}
        uiSchema={uiSchema}
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
