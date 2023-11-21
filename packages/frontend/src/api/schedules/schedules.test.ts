import BackendScheduleClient from './schedules';

test('GetAllSchedules', async () => {
  const client = new BackendScheduleClient('http://localhost:3001');
  const schedules = await client.GetAllSchedules();
  expect(schedules.length).toBeGreaterThan(0);
});
