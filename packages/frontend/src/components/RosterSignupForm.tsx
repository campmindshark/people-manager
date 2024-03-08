import React, { useMemo, useState } from 'react';
import validator from '@rjsf/validator-ajv8';
import Form from '@rjsf/mui';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import Snackbar from '@mui/material/Snackbar';
import BackendRosterClient from 'src/api/roster/roster';

import { CurrentRosterID } from 'src/state/roster';
import { getFrontendConfig } from '../config/config';

const frontendConfig = getFrontendConfig();

function RosterSignupForm() {
  const [rosterParticipant, setRosterParticipant] = useState(
    new RosterParticipant(),
  );
  const [open, setOpen] = React.useState(false);

  const userClient = useMemo(
    () => new BackendRosterClient(frontendConfig.BackendURL),
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

    const { formData } = data as { formData: RosterParticipant };

    const updatedUser = await userClient.Signup(CurrentRosterID, formData);
    setRosterParticipant(updatedUser);
    setOpen(true);
  };

  return (
    <>
      <Form
        schema={RosterParticipant.formSchema}
        validator={validator}
        onSubmit={handleSubmit}
        formData={rosterParticipant}
        uiSchema={RosterParticipant.formUiSchema}
      />
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        message="Roster Participant Updated!"
      />
    </>
  );
}

export default RosterSignupForm;
