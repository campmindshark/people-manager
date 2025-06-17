import React, { useState } from 'react';
import { useRecoilValue } from 'recoil';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Slider,
  Switch,
  TextField,
  Checkbox,
  FormHelperText,
  Snackbar,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import RosterParticipant from 'backend/models/roster_participant/roster_participant';
import { CurrentUserSignupStatus } from '../state/store';
import { getFrontendConfig } from '../config/config';
import BackendRosterClient from '../api/roster/roster';

const frontendConfig = getFrontendConfig();
const rosterClient = new BackendRosterClient(frontendConfig.BackendURL);

interface Props {
  handleSuccess: () => void;
  rosterParticipant: RosterParticipant;
}

interface RosterParticipantFormData {
  probabilityOfAttending: number;
  hasTicket: boolean;
  hasVehiclePass: boolean;
  extraTickets: boolean;
  yearsAttended: number;
  yearsAtCamp: number[];
  estimatedArrivalDate: Date | null;
  estimatedDepartureDate: Date | null;
  sleepingArrangement: string;
  earlyArrivalInterest: boolean;
  postBurnInterest: boolean;
  hasReadEssentialMindshark: boolean;
  agreesToParticipateInTearDown: boolean;
  agreesToParticipateInShifts: boolean;
  agreesToPayDues: boolean;
}

const YEARS_AT_CAMP_OPTIONS = [
  2013, 2014, 2015, 2016, 2017, 2018, 2019, 2022, 2023, 2024,
];

function RosterSignupFormV2({ handleSuccess, rosterParticipant }: Props) {
  const [formData, setFormData] = useState<RosterParticipantFormData>({
    probabilityOfAttending: rosterParticipant.probabilityOfAttending || 0,
    hasTicket: rosterParticipant.hasTicket || false,
    hasVehiclePass: rosterParticipant.hasVehiclePass || false,
    extraTickets: rosterParticipant.extraTickets || false,
    yearsAttended: rosterParticipant.yearsAttended || 0,
    yearsAtCamp: rosterParticipant.yearsAtCamp || [],
    estimatedArrivalDate: rosterParticipant.estimatedArrivalDate
      ? new Date(rosterParticipant.estimatedArrivalDate)
      : null,
    estimatedDepartureDate: rosterParticipant.estimatedDepartureDate
      ? new Date(rosterParticipant.estimatedDepartureDate)
      : null,
    sleepingArrangement: rosterParticipant.sleepingArrangement || '',
    earlyArrivalInterest: rosterParticipant.earlyArrivalInterest || false,
    postBurnInterest: rosterParticipant.postBurnInterest || false,
    hasReadEssentialMindshark:
      rosterParticipant.hasReadEssentialMindshark || false,
    agreesToParticipateInTearDown:
      rosterParticipant.agreesToParticipateInTearDown || false,
    agreesToParticipateInShifts:
      rosterParticipant.agreesToParticipateInShifts || false,
    agreesToPayDues: rosterParticipant.agreesToPayDues || false,
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const userSignupStatus = useRecoilValue(CurrentUserSignupStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rosterClient.Signup(2, formData as unknown as RosterParticipant);
      setSnackbarOpen(true);
      if (
        !userSignupStatus.hasCompletedPrivateProfile ||
        !userSignupStatus.hasCompletedPublicProfile
      ) {
        window.location.href = '/profile-edit';
      } else {
        handleSuccess();
      }
    } catch (error) {
      console.error('Failed to submit form:', error);
    }
  };

  const handleChange = <K extends keyof RosterParticipantFormData>(
    field: K,
    value: RosterParticipantFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCloseSnackbar = (
    event: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <FormHelperText sx={{ mb: 2, color: 'text.secondary' }}>
          * Required fields
        </FormHelperText>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <FormLabel>Probability of attending (0-100) *</FormLabel>
              <Slider
                value={formData.probabilityOfAttending || 0}
                onChange={(_, value) =>
                  handleChange('probabilityOfAttending', value)
                }
                min={0}
                max={100}
                marks
              />
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hasTicket || false}
                  onChange={(e) => handleChange('hasTicket', e.target.checked)}
                />
              }
              label="Do you have a ticket?"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hasVehiclePass || false}
                  onChange={(e) =>
                    handleChange('hasVehiclePass', e.target.checked)
                  }
                />
              }
              label="Do you have a vehicle pass?"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.extraTickets || false}
                  onChange={(e) =>
                    handleChange('extraTickets', e.target.checked)
                  }
                />
              }
              label="Do you have extra tickets?"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              type="number"
              label="How many years have you attended the burn? *"
              required
              value={formData.yearsAttended || ''}
              onChange={(e) =>
                handleChange('yearsAttended', parseInt(e.target.value, 10))
              }
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel>
                How many years have you camped with MindShark?
              </FormLabel>
              <FormGroup>
                {YEARS_AT_CAMP_OPTIONS.map((year) => (
                  <FormControlLabel
                    key={year}
                    control={
                      <Checkbox
                        checked={formData.yearsAtCamp?.includes(year) || false}
                        onChange={(e) => {
                          const newYears = e.target.checked
                            ? [...(formData.yearsAtCamp || []), year]
                            : (formData.yearsAtCamp || []).filter(
                                (y) => y !== year,
                              );
                          handleChange('yearsAtCamp', newYears);
                        }}
                      />
                    }
                    label={year.toString()}
                  />
                ))}
              </FormGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <DateTimePicker
              label="When do you plan to arrive? *"
              value={
                formData.estimatedArrivalDate
                  ? new Date(formData.estimatedArrivalDate)
                  : null
              }
              onChange={(date: Date | null) =>
                handleChange('estimatedArrivalDate', date)
              }
              timezone="America/Los_Angeles"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: 'Gates open Sunday, August 24th',
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <DateTimePicker
              label="When do you plan to depart? *"
              value={
                formData.estimatedDepartureDate
                  ? new Date(formData.estimatedDepartureDate)
                  : null
              }
              onChange={(date: Date | null) =>
                handleChange('estimatedDepartureDate', date)
              }
              timezone="America/Los_Angeles"
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  helperText: 'Temple burns Sunday, August 31st',
                },
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth required>
              <FormLabel>What is your sleeping arrangement? *</FormLabel>
              <TextField
                select
                value={formData.sleepingArrangement || ''}
                onChange={(e) =>
                  handleChange('sleepingArrangement', e.target.value)
                }
                SelectProps={{
                  native: true,
                }}
              >
                <option value="">Select an option</option>
                <option value="Personal tent - something that requires camp shade">
                  Personal tent - something that requires camp shade
                </option>
                <option value="Personal yurt, shift pod, etc - something that doesn't require shade">
                  Personal yurt, shift pod, etc - something that doesn&apos;t
                  require shade
                </option>
                <option value="Other...">Other...</option>
              </TextField>
              <FormHelperText>
                *RVs are not permitted in our camp:* We *do not* have the space
                per unit person to have RVs in our camp, so that is not an
                acceptable answer. Modified vehicles (e.g., a school bus from
                Pimp My Ride) are OK.
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.earlyArrivalInterest || false}
                  onChange={(e) =>
                    handleChange('earlyArrivalInterest', e.target.checked)
                  }
                />
              }
              label="Are you interested in early arrival?"
            />
            <FormHelperText>
              This is a team of ~30 who arrive Wednesday or Thursday before the
              gates open to set up the camp and requires a special pass.
            </FormHelperText>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.postBurnInterest || false}
                  onChange={(e) =>
                    handleChange('postBurnInterest', e.target.checked)
                  }
                />
              }
              label="Are you interested in post-burn?"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hasReadEssentialMindshark || false}
                  onChange={(e) =>
                    handleChange('hasReadEssentialMindshark', e.target.checked)
                  }
                />
              }
              label={
                <>
                  I have read the essential MindShark. (
                  <a
                    href="https://rb.gy/zmxncc"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline' }}
                  >
                    https://rb.gy/zmxncc
                  </a>
                  ) *
                </>
              }
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.agreesToParticipateInTearDown || false}
                  onChange={(e) =>
                    handleChange(
                      'agreesToParticipateInTearDown',
                      e.target.checked,
                    )
                  }
                />
              }
              label="I agree to participate in the camp tear-down. *"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.agreesToParticipateInShifts || false}
                  onChange={(e) =>
                    handleChange(
                      'agreesToParticipateInShifts',
                      e.target.checked,
                    )
                  }
                />
              }
              label="I agree to participate in camp shifts. *"
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.agreesToPayDues || false}
                  onChange={(e) =>
                    handleChange('agreesToPayDues', e.target.checked)
                  }
                />
              }
              label="I agree to pay camp dues. *"
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={
                !formData.probabilityOfAttending ||
                !formData.estimatedArrivalDate ||
                !formData.estimatedDepartureDate ||
                !formData.sleepingArrangement ||
                !formData.hasReadEssentialMindshark ||
                !formData.agreesToParticipateInTearDown ||
                !formData.agreesToParticipateInShifts ||
                !formData.agreesToPayDues
              }
            >
              Submit
            </Button>
          </Grid>
        </Grid>
      </Box>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message="Roster Participant Updated!"
      />
    </>
  );
}

export default RosterSignupFormV2;
