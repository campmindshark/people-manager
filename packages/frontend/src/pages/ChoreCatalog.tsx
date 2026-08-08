import React, { useEffect } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useSetRecoilState } from 'recoil';
import ChoreCatalogTable from '../components/admin/ChoreCatalogTable';
import Dashboard from '../layouts/dashboard/Dashboard';
import PageState from '../state/store';

export default function ChoreCatalog() {
  const setPageState = useSetRecoilState(PageState);

  useEffect(() => {
    setPageState({
      title: 'Chore Scores',
      index: 'admin-chore-scores',
    });
  }, [setPageState]);

  return (
    <Dashboard>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h4" gutterBottom>
            Chore planning scores
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Review the fixed chore, event, and dinner definitions. Scores are
            the only editable catalog field.
          </Typography>
          <ChoreCatalogTable />
        </Paper>
      </Container>
    </Dashboard>
  );
}
