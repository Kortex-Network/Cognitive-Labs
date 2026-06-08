import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Badge,
} from "@mui/material";
import {
  AccountBalanceWallet,
  Brightness4,
  Brightness7,
  Menu as MenuIcon,
  QrCodeScanner,
  Circle,
  Logout,
} from "@mui/icons-material";
import { useWallet } from "../contexts/WalletContext";
import { useThemeMode } from "../contexts/ThemeContext";
import LanguageSelector from "./LanguageSelector";

const DRAWER_WIDTH = 260;

const Navbar = () => {
  const { t } = useTranslation();
  const { wallet, isConnected, disconnectWallet } = useWallet();
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { label: t("navigation.dashboard"), to: "/" },
    { label: t("navigation.credentials"), to: "/credentials" },
    { label: "Analytics", to: "/analytics" },
    { label: t("navigation.createLABS"), to: "/create-LABS" },
    { label: t("navigation.resolveLABS"), to: "/resolve-LABS" },
    { label: "Verify", to: "/verify-credential" },
    { label: t("navigation.scanner"), to: "/scanner" },
    { label: t("navigation.account"), to: "/account" },
  ];

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const drawerContent = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2 }}>
        Stellar LABS Platform
      </Typography>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton sx={{ textAlign: 'center' }} component={NavLink} to={item.to}>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <LanguageSelector />
        {/* Mobile Wallet Status Indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mt: 2,
            p: 1.5,
            borderRadius: 2,
            backgroundColor: isConnected 
              ? 'rgba(76, 175, 80, 0.15)' 
              : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid',
            borderColor: isConnected 
              ? 'rgba(76, 175, 80, 0.4)' 
              : 'rgba(255, 255, 255, 0.2)',
          }}
        >
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Circle
                sx={{
                  fontSize: 8,
                  color: isConnected ? '#4caf50' : '#f44336',
                  backgroundColor: isConnected ? '#4caf50' : '#f44336',
                  borderRadius: '50%',
                  border: '1.5px solid',
                  borderColor: 'background.default',
                }}
              />
            }
          >
            <AccountBalanceWallet 
              sx={{ 
                color: isConnected ? 'success.main' : 'text.secondary',
                fontSize: 28,
              }} 
            />
          </Badge>
          
          <Box sx={{ flex: 1, textAlign: 'left' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 600,
                color: isConnected ? 'success.main' : 'text.secondary',
              }}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Typography>
            <Typography 
              variant="caption" 
              sx={{ 
                color: isConnected ? 'text.primary' : 'text.disabled',
                display: 'block',
              }}
            >
              {isConnected 
                ? `${wallet?.publicKey?.slice(0, 6)}...${wallet?.publicKey?.slice(-4)}`
                : 'No wallet connected'}
            </Typography>
          </Box>
          
          {isConnected && (
            <Tooltip title="Disconnect wallet">
              <IconButton
                size="small"
                onClick={() => {
                  handleDrawerToggle();
                  handleDisconnect();
                }}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'error.main',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  },
                }}
              >
                <Logout sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "rgba(9, 19, 26, 0.78)",
        }}
      >
        <Toolbar
          sx={{
            gap: 2,
            justifyContent: "space-between",
            flexWrap: "wrap",
            py: 1,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                background:
                  "linear-gradient(135deg, rgba(90,209,230,0.9), rgba(255,184,77,0.9))",
                color: "#081117",
              }}
            >
              <QrCodeScanner />
            </Box>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography variant="h6" noWrap>
                Stellar LABS Platform
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Cognitive Lab
              </Typography>
            </Box>
          </Stack>

          {/* Desktop nav */}
          {!isMobile && (
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ flex: 1, justifyContent: "center" }}
            >
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  color="inherit"
                  size="small"
                  sx={{
                    textDecoration: "none",
                    "&.active": { fontWeight: "bold", opacity: 1 },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          )}

          {/* Right actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <LanguageSelector />

            <Tooltip
              title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
            >
              <IconButton
                color="inherit"
                onClick={toggleTheme}
                aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
                size="small"
              >
                {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Tooltip>

            {!isMobile && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  backgroundColor: isConnected 
                    ? 'rgba(76, 175, 80, 0.15)' 
                    : 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid',
                  borderColor: isConnected 
                    ? 'rgba(76, 175, 80, 0.4)' 
                    : 'rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Connection Status Indicator */}
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Circle
                      sx={{
                        fontSize: 10,
                        color: isConnected ? '#4caf50' : '#f44336',
                        backgroundColor: isConnected ? '#4caf50' : '#f44336',
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: 'background.paper',
                      }}
                    />
                  }
                >
                  <AccountBalanceWallet 
                    sx={{ 
                      color: isConnected ? 'success.main' : 'text.secondary',
                      fontSize: 24,
                    }} 
                  />
                </Badge>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontWeight: 600,
                      color: isConnected ? 'success.main' : 'text.secondary',
                      fontSize: '0.7rem',
                      lineHeight: 1.2,
                    }}
                  >
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: isConnected ? 'text.primary' : 'text.disabled',
                      fontSize: '0.65rem',
                    }}
                  >
                    {isConnected 
                      ? `${wallet?.publicKey?.slice(0, 6)}...${wallet?.publicKey?.slice(-4)}`
                      : 'No wallet'}
                  </Typography>
                </Box>
                
                {isConnected && (
                  <Tooltip title="Disconnect wallet">
                    <IconButton
                      size="small"
                      onClick={handleDisconnect}
                      sx={{
                        ml: 0.5,
                        color: 'text.secondary',
                        '&:hover': {
                          color: 'error.main',
                          backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        },
                      }}
                    >
                      <Logout sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Navbar;
