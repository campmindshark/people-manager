import BackendUserClient from './client';

test('GetAllUsers', async () => {
  const client = new BackendUserClient('http://localhost:3001');
  const users = await client.GetAllUsers();
  expect(users.length).toBeGreaterThan(0);
});

test('GetAuthenticatedUser', async () => {
  const client = new BackendUserClient('http://localhost:3001');
  client.GetAuthenticatedUser().catch((err) => {
    expect(err.response.status).toBe(401);
  });
});
