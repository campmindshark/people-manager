import React, { useCallback } from 'react';
import { Grid } from '@mui/material';
import { useRecoilValue } from 'recoil';
import { CurrentRosterParticipantsState } from '../state/roster';
import Stat from './stats/Stat';

function RosterStats() {
  const participants = useRecoilValue(CurrentRosterParticipantsState);

  const getYearsOfExperience = useCallback(
    () =>
      participants.reduce(
        (acc, p) => acc + p.rosterParticipant.yearsAttended,
        0,
      ),
    [participants],
  );

  const getPercentageOfVirgins = useCallback(
    () =>
      participants.filter((p) => p.rosterParticipant.yearsAttended === 0)
        .length / participants.length,
    [participants],
  );

  const hasTickets = useCallback(
    () => participants.filter((p) => p.rosterParticipant.hasTicket).length,
    [participants],
  );

  return (
    <Grid container spacing={2}>
      <Grid item>
        <Stat value={participants.length} unit="Participants" />
      </Grid>
      <Grid item>
        <Stat value={getYearsOfExperience()} unit="Years of Experience" />
      </Grid>
      <Grid item>
        <Stat
          value={(getPercentageOfVirgins() * 100).toFixed(2)}
          unit="% Virgins"
        />
      </Grid>
      <Grid item>
        <Stat value={hasTickets()} unit="Has Ticket" />
      </Grid>
    </Grid>
  );
}

export default RosterStats;
