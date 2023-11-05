import BackendUserClient from './client';

test('GetAllUsers', async () => {
  const client = new BackendUserClient('http://localhost:3001');
  const users = await client.GetAllUsers();
  console.log(users);
  expect(users.length).toBeGreaterThan(0);
});
