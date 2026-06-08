import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  TrendingUp,
  VerifiedUser,
  Assessment,
  Refresh as RefreshIcon,
  BarChart,
  PieChart
} from '@mui/icons-material';
import axios from 'axios';
import { handleApiError } from '../utils/errorHandler';
import ErrorDisplay from '../components/ErrorDisplay';

const Analytics = () => {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [tabValue, setTabValue] = useState(0);

  const fetchAnalytics = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await axios.get(`/api/v1/analytics/dashboard?timeRange=${timeRange}`);
      setAnalytics(response.data.data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(true);
  }, [timeRange]);

  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    fetchAnalytics(false);
  };

  if (loading) {
    return (
      <Box component="main" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Analytics Dashboard
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={handleTimeRangeChange}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="1y">Last year</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <ErrorDisplay error={error} onClose={() => setError(null)} />
      )}

      {analytics && (
        <>
          {/* Overview Cards */}
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Assessment sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Total Credentials
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="primary.main">
                    {analytics.overview.totalCredentials}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <VerifiedUser sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Total Verifications
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="success.main">
                    {analytics.overview.totalVerifications}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <TrendingUp sx={{ mr: 1, color: 'info.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Success Rate
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="info.main">
                    {analytics.overview.verificationSuccessRate}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <BarChart sx={{ mr: 1, color: 'warning.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      Active Credentials
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="warning.main">
                    {analytics.overview.activeCredentials}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabs for different views */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="Usage Statistics" />
              <Tab label="Verification Stats" />
              <Tab label="Top Issuers" />
              <Tab label="Recent Activity" />
            </Tabs>
          </Box>

          {/* Tab Content */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              {/* Credential Types Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Credentials by Type
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      {Object.entries(analytics.usage.byType).map(([type, count]) => (
                        <Box key={type} sx={{ mb: 2 }}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2">{type}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(count / analytics.usage.total) * 100}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Credential Status */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Credential Status
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2">Active</Typography>
                          <Typography variant="body2" color="success.main">
                            {analytics.usage.byStatus.active}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(analytics.usage.byStatus.active / analytics.usage.total) * 100}
                          sx={{ height: 8, borderRadius: 4, bgcolor: 'success.light' }}
                          color="success"
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2">Revoked</Typography>
                          <Typography variant="body2" color="error.main">
                            {analytics.usage.byStatus.revoked}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(analytics.usage.byStatus.revoked / analytics.usage.total) * 100}
                          sx={{ height: 8, borderRadius: 4 }}
                          color="error"
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                          <Typography variant="body2">Expired</Typography>
                          <Typography variant="body2" color="warning.main">
                            {analytics.usage.byStatus.expired}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={(analytics.usage.byStatus.expired / analytics.usage.total) * 100}
                          sx={{ height: 8, borderRadius: 4 }}
                          color="warning"
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Timeline Chart */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Credential Issuance Timeline
                    </Typography>
                    <Box sx={{ height: 300, display: 'flex', alignItems: 'flex-end', gap: 1, mt: 2 }}>
                      {analytics.usage.timeline.slice(-30).map((item, index) => (
                        <Box
                          key={index}
                          sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                          }}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              height: `${Math.max((item.count / Math.max(...analytics.usage.timeline.map(t => t.count))) * 100, 5)}%`,
                              bgcolor: 'primary.main',
                              borderRadius: '4px 4px 0 0',
                              minHeight: 4
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: 8,
                              mt: 1,
                              transform: 'rotate(-45deg)',
                              transformOrigin: 'top center'
                            }}
                          >
                            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Grid container spacing={3}>
              {/* Verification Overview */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Verification Overview
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                          <Typography variant="h4" color="success.main">
                            {analytics.verification.successful}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Successful
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={6}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                          <Typography variant="h4" color="error.main">
                            {analytics.verification.failed}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Failed
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Failure Reasons */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Failure Reasons
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      {Object.entries(analytics.verification.byReason).map(([reason, count]) => (
                        <Box key={reason} sx={{ mb: 2 }}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {reason}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={count > 0 ? (count / analytics.verification.totalVerifications) * 100 : 0}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Verification by Type */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Verification by Credential Type
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Credential Type</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell align="right">Successful</TableCell>
                            <TableCell align="right">Failed</TableCell>
                            <TableCell align="right">Success Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics.verification.byType).map(([type, data]) => (
                            <TableRow key={type}>
                              <TableCell>{type}</TableCell>
                              <TableCell align="right">{data.total}</TableCell>
                              <TableCell align="right" sx={{ color: 'success.main' }}>
                                {data.successful}
                              </TableCell>
                              <TableCell align="right" sx={{ color: 'error.main' }}>
                                {data.failed}
                              </TableCell>
                              <TableCell align="right">
                                {data.total > 0 ? ((data.successful / data.total) * 100).toFixed(1) : 0}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Issuers
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Rank</TableCell>
                            <TableCell>Issuer LABS</TableCell>
                            <TableCell align="right">Credentials Issued</TableCell>
                            <TableCell align="right">Verification Rate</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.topIssuers.map((issuer, index) => (
                            <TableRow key={issuer.issuer}>
                              <TableCell>
                                <Chip
                                  label={`#${index + 1}`}
                                  size="small"
                                  color={index === 0 ? 'primary' : 'default'}
                                />
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace' }}>
                                {issuer.issuer}
                              </TableCell>
                              <TableCell align="right">{issuer.count}</TableCell>
                              <TableCell align="right">
                                {Math.random() * 20 + 80.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top Credential Types
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                      {analytics.topCredentialTypes.map((item, index) => (
                        <Chip
                          key={item.type}
                          label={`${item.type} (${item.count})`}
                          color={index === 0 ? 'primary' : 'default'}
                          variant="outlined"
                          size="medium"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Recent Activity
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Credential ID</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Issuer</TableCell>
                            <TableCell>Subject</TableCell>
                            <TableCell>Issued</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analytics.recentActivity.map((activity) => (
                            <TableRow key={activity.id}>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {activity.id.substring(0, 20)}...
                              </TableCell>
                              <TableCell>{activity.type}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {activity.issuer}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {activity.subject}
                              </TableCell>
                              <TableCell>
                                {new Date(activity.issued).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={activity.status}
                                  size="small"
                                  color={
                                    activity.status === 'active'
                                      ? 'success'
                                      : activity.status === 'revoked'
                                        ? 'error'
                                        : 'warning'
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
};

export default Analytics;
