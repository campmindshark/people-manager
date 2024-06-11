import React, { useMemo } from 'react';
import { Button } from '@mui/material';
import { useRecoilValue } from 'recoil';
import {
  CreateCSVHeader,
  CreateCSVRow,
} from 'backend/view_models/roster_participant';
import { CurrentRosterParticipantsDetailedState } from '../../state/roster';

function RosterParticipantCSVDownloadBtn() {
  const detailedParticipants = useRecoilValue(
    CurrentRosterParticipantsDetailedState,
  );

  const csvData = useMemo(() => {
    const header = CreateCSVHeader();
    const rows = detailedParticipants.map(CreateCSVRow);
    const allRows = [header, ...rows];
    return allRows.join('\n');
  }, [detailedParticipants]);

  const downloadCSV = () => {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roster.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Button variant="contained" color="primary" onClick={downloadCSV}>
      Download Roster Participants CSV
    </Button>
  );
}

export default RosterParticipantCSVDownloadBtn;
