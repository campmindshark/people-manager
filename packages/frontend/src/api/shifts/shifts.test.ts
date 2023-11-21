import BackendShiftSchedule from './shifts';

test('GetAllShifts', async () => {
  const client = new BackendShiftSchedule('http://localhost:3001');
  const schedules = await client.GetAllShifts();
  expect(schedules.length).toBeGreaterThan(0);
});
