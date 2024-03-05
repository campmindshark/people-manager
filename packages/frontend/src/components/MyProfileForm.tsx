import React from 'react';
import validator from '@rjsf/validator-ajv8';
import { UiSchema } from '@rjsf/utils';
import Form from '@rjsf/mui';
import User from 'backend/models/user/user';
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
};

function MyProfileForm() {
  const [userState, setUserState] = useRecoilState(UserState);
  const userClient = new BackendUserClient(frontendConfig.BackendURL);

  const handleSubmit = async (data: any) => {
    console.log(data);

    const { formData } = data as { formData: User };
    formData.skillsOfNote = formData.skillsOfNote || [];

    const updatedUser = await userClient.UpdateUser(formData);
    console.log(updatedUser);
    setUserState(updatedUser);
  };
  console.log(userState);

  return (
    <Form
      schema={User.formSchema}
      validator={validator}
      onSubmit={handleSubmit}
      formData={userState}
      uiSchema={uiSchema}
    />
  );
}

export default MyProfileForm;
