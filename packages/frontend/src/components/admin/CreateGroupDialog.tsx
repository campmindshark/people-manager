import React, { useMemo } from 'react';
import validator from '@rjsf/validator-ajv8';
import { Dialog, DialogTitle, DialogContent, Typography } from '@mui/material';
import Group from 'backend/models/group/group';
import Form from '@rjsf/mui';
import BackendGroupClient from 'src/api/groups/groups';
import { getFrontendConfig } from 'src/config/config';
import { browserLocalInputToEventTime } from '../../utils/datetime/utils';

const frontendConfig = getFrontendConfig();

interface Props {
  open: boolean;
  handleClose: () => void;
  handleSuccess: () => void;
}

function CreateGroupDialog(props: Props) {
  const { open, handleClose, handleSuccess } = props;

  const groupClient = useMemo(
    () => new BackendGroupClient(frontendConfig.BackendURL),
    [frontendConfig.BackendURL],
  );

  const handleSubmit = async (data: unknown) => {
    const { formData } = data as { formData: Group };

    await groupClient.CreateGroup({
      ...formData,
      shiftSignupOpenDate: browserLocalInputToEventTime(
        String(formData.shiftSignupOpenDate),
      ),
    } as Group);
    handleSuccess();
  };

  return (
    <Dialog onClose={handleClose} open={open} maxWidth="lg">
      <DialogTitle>
        <Typography variant="h4">Create Group</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Typography color="text.secondary" sx={{ mb: 2 }} variant="body2">
          Shift signup times are entered and displayed in Pacific Time.
        </Typography>
        <Form
          schema={Group.formSchema}
          validator={validator}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

export default CreateGroupDialog;
