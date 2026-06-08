import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  Modal,
} from "@mui/material";
import {
  Search,
  ContentCopy,
  AccountBalance,
  VerifiedUser,
  Schedule,
  Info,
  QrCodeScanner,
  Close,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "react-toastify";
import { stellarAPI } from "../services/api";
import { handleApiError } from "../utils/errorHandler";
import ErrorDisplay from "../components/ErrorDisplay";
import QRScanner from "../components/QRScanner";

const schema = yup.object().shape({
  LABS: yup.string()
    .required('LABS is required')
    .matches(/^LABS:stellar:G[A-Z2-7]{55}$/, 'Invalid LABS format. Expected: LABS:stellar:G...'),
});

const ResolveLABS = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      LABS: "",
    },
  });

  const handleResolveLABS = async (data) => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await stellarAPI.contracts.getLABS(data.LABS);

      setResult(response.data);
      toast.success("LABS resolved successfully!");
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleScanResult = (payload) => {
    setScannerOpen(false);
    if (payload?.LABS) {
      reset({ LABS: payload.LABS });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box component="main" aria-label="Resolve LABS page">
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Resolve LABS
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Enter a LABS to resolve and view its associated identity document
      </Typography>

      <Grid container spacing={3} role="region" aria-label="Resolve LABS form">
        {/* LABS Resolution Form */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit(handleResolveLABS)} aria-label="Resolve LABS form">
                <Controller
                  name="LABS"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Decentralized Identifier (LABS)"
                      placeholder="LABS:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"
                      fullWidth
                      margin="normal"
                      error={!!errors.LABS}
                      helperText={errors.LABS?.message || 'Format: LABS:stellar:G...'}
                      inputProps={{
                        'aria-describedby': errors.LABS ? 'LABS-error-message' : undefined,
                      }}
                      InputProps={{
                        startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} aria-hidden="true" />,
                      }}
                    />
                  )}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} aria-hidden="true" /> : <Search />}
                  sx={{ mt: 2 }}
                  aria-label={loading ? 'Resolving LABS' : 'Resolve LABS'}
                >
                  Resolve LABS
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Examples */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom component="h2">
                Quick Examples
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Try these example LABSs (if available on testnet):
              </Typography>
              
              <div role="list" aria-label="Example LABSs">
                {[
                  'LABS:stellar:GD5DQ6ZJ6G5ZQJQKQZQZQZQZQZQZQZQZQZQZQZQ',
                  'LABS:stellar:GA2GB6ZJ6G5ZQJQKQZQZQZQZQZQZQZQZQZQZQZQ',
                ].map((LABS, index) => (
                  <Paper 
                    key={index} 
                    sx={{ p: 2, mb: 1, bgcolor: 'background.default', cursor: 'pointer' }}
                    onClick={() => reset({ LABS })}
                    role="listitem"
                    tabIndex={0}
                    onKeyPress={(e) => { if (e.key === 'Enter') reset({ LABS }); }}
                    aria-label={`Example LABS: ${LABS}`}
                  >
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {LABS}
                    </Typography>
                  </Paper>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Results */}
        {result && (
          <Grid item xs={12} role="region" aria-label="LABS resolution results">
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={3}>
                  <VerifiedUser sx={{ mr: 1, color: 'success.main' }} aria-hidden="true" />
                  <Typography variant="h6" color="success.main" component="h2">
                    LABS Document Resolved
                  </Typography>
                </Box>

                {/* Basic Information */}
                <Grid container spacing={3} role="list" aria-label="LABS document details">
                  <Grid item xs={12} md={6} role="listitem">
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="LABS-label">
                        LABS
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }} aria-labelledby="LABS-label">
                          {result.LABS}
                        </Typography>
                        <Tooltip title="Copy LABS">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(result.LABS)}
                            aria-label="Copy LABS to clipboard"
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6} role="listitem">
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="owner-label">
                        Owner
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }} aria-labelledby="owner-label">
                          {result.owner}
                        </Typography>
                        <Tooltip title="Copy Owner">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(result.owner)}
                            aria-label="Copy owner to clipboard"
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6} role="listitem">
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="status-label">
                        Status
                      </Typography>
                      <Chip
                        label={result.active ? "Active" : "Inactive"}
                        color={result.active ? "success" : "error"}
                        size="small"
                        aria-label={`Status: ${result.active ? 'Active' : 'Inactive'}`}
                      />
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6} role="listitem">
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="created-label">
                        Created
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Schedule sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} aria-hidden="true" />
                        <Typography variant="body1" aria-labelledby="created-label">
                          {formatDate(result.created)}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {result.serviceEndpoint && (
                    <Grid item xs={12} role="listitem">
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom id="service-label">
                          Service Endpoint
                        </Typography>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body1" sx={{ mr: 1 }} aria-labelledby="service-label">
                            {result.serviceEndpoint}
                          </Typography>
                          <Tooltip title="Copy Service Endpoint">
                            <IconButton 
                              size="small" 
                              onClick={() => copyToClipboard(result.serviceEndpoint)}
                              aria-label="Copy service endpoint to clipboard"
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </Grid>
                  )}

                  {result.updated && result.updated !== result.created && (
                    <Grid item xs={12} role="listitem">
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom id="updated-label">
                          Last Updated
                        </Typography>
                        <Box display="flex" alignItems="center">
                          <Schedule sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} aria-hidden="true" />
                          <Typography variant="body1" aria-labelledby="updated-label">
                            {formatDate(result.updated)}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  )}
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* Raw JSON */}
                <Box role="region" aria-label="Raw LABS document JSON">
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    <Info sx={{ verticalAlign: 'middle', mr: 1 }} aria-hidden="true" />
                    Raw LABS Document
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" component="pre" sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.8rem',
                      overflowX: 'auto',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }} aria-label="LABS document JSON">
                      {JSON.stringify(result, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <ErrorDisplay error={error} onClose={() => setError(null)} />
          </Grid>
        )}
      </Grid>

      {/* QR Scanner Modal */}
      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        aria-label="QR code scanner modal"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "95vw", sm: 480 },
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          <QRScanner
            allowedTypes={["LABS"]}
            onScan={handleScanResult}
            onClose={() => setScannerOpen(false)}
          />
        </Box>
      </Modal>
    </Box>
  );
};

export default ResolveLABS;
