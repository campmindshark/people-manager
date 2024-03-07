import React, { useMemo, useEffect, useState, SyntheticEvent } from 'react';
import validator from '@rjsf/validator-ajv8';
import { UiSchema } from '@rjsf/utils';
import Form from '@rjsf/mui';
import PrivateProfile from 'backend/models/user/user_private';
import Snackbar from '@mui/material/Snackbar';

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

function MyPrivateProfileForm() {
  const [myPrivateProfileState, setMyPrivateProfileState] = useState(
    new PrivateProfile(),
  );
  const [open, setOpen] = useState(false);
  const userClient = useMemo(
    () => new BackendUserClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
  );

  const handleClose = (event: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  const handleSubmit = async (data: any) => {
    console.log(data);

    const { formData } = data as { formData: PrivateProfile };

    const updatedPrivateProfile =
      await userClient.UpdatePrivateProfile(formData);
    setMyPrivateProfileState(updatedPrivateProfile);
    setOpen(true);
  };

  useEffect(() => {
    const doAuth = async () => {
      try {
        const response = await userClient.GetMyPrivateProfile();
        console.log('auth success', response);
        setMyPrivateProfileState(response);
      } catch (err) {
        console.log('auth error', err);
      }
    };

    doAuth();
  }, []);

  return (
    <>
      <Form
        schema={PrivateProfile.formSchema}
        validator={validator}
        onSubmit={handleSubmit}
        formData={myPrivateProfileState}
        uiSchema={uiSchema}
      />
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message="Private Profile Updated!"
      />
    </>
  );
}

export default MyPrivateProfileForm;
