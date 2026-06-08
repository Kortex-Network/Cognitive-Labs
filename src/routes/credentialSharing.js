const express = require("express");
const CredentialSharingService = require("../services/credentialSharingService");
const { sendError } = require("../middleware/errorHandler");
const router = express.Router();
const sharingService = new CredentialSharingService();

/**
 * POST /api/sharing/share
 * Share a credential with a third party
 */
router.post("/share", async (req, res) => {
  try {
    const {
      credentialId,
      sharedByLABS,
      sharedWithLABS,
      expiresIn,
      maxAccessCount,
      purpose,
    } = req.body;

    // Validate required fields
    if (!credentialId || !sharedByLABS || !sharedWithLABS) {
      return sendError(
        res,
        400,
        "Missing required fields: credentialId, sharedByLABS, sharedWithLABS",
        "VALIDATION_ERROR",
      );
    }

    const result = await sharingService.shareCredential(
      credentialId,
      sharedByLABS,
      sharedWithLABS,
      {
        expiresIn,
        maxAccessCount,
        purpose,
      },
    );

    res.status(201).json(result);
  } catch (error) {
    console.error("Share credential error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * POST /api/sharing/access
 * Access a shared credential
 */
router.post("/access", async (req, res) => {
  try {
    const { sharingId, accessToken, requestorLABS } = req.body;

    // Validate required fields
    if (!sharingId || !accessToken || !requestorLABS) {
      return sendError(
        res,
        400,
        "Missing required fields: sharingId, accessToken, requestorLABS",
        "VALIDATION_ERROR",
      );
    }

    const result = await sharingService.accessSharedCredential(
      sharingId,
      accessToken,
      requestorLABS,
    );

    res.json(result);
  } catch (error) {
    console.error("Access shared credential error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * POST /api/sharing/revoke
 * Revoke a shared credential
 */
router.post("/revoke", async (req, res) => {
  try {
    const { sharingId, sharedByLABS } = req.body;

    // Validate required fields
    if (!sharingId || !sharedByLABS) {
      return sendError(
        res,
        400,
        "Missing required fields: sharingId, sharedByLABS",
        "VALIDATION_ERROR",
      );
    }

    const result = await sharingService.revokeSharedCredential(
      sharingId,
      sharedByLABS,
    );

    res.json(result);
  } catch (error) {
    console.error("Revoke shared credential error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * GET /api/sharing/my-shares
 * Get all credentials shared by a LABS
 */
router.get("/my-shares", async (req, res) => {
  try {
    const { LABS } = req.query;

    if (!LABS) {
      return sendError(
        res,
        400,
        "LABS query parameter is required",
        "VALIDATION_ERROR",
      );
    }

    const result = await sharingService.getSharedCredentials(LABS, "sharedBy");

    res.json(result);
  } catch (error) {
    console.error("Get my shares error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * GET /api/sharing/shared-with-me
 * Get all credentials shared with a LABS
 */
router.get("/shared-with-me", async (req, res) => {
  try {
    const { LABS } = req.query;

    if (!LABS) {
      return sendError(
        res,
        400,
        "LABS query parameter is required",
        "VALIDATION_ERROR",
      );
    }

    const result = await sharingService.getSharedCredentials(LABS, "sharedWith");

    res.json(result);
  } catch (error) {
    console.error("Get shared with me error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * POST /api/sharing/extend
 * Extend expiration of a shared credential
 */
router.post("/extend", async (req, res) => {
  try {
    const { sharingId, sharedByLABS, additionalSeconds } = req.body;

    // Validate required fields
    if (!sharingId || !sharedByLABS || !additionalSeconds) {
      return sendError(
        res,
        400,
        "Missing required fields: sharingId, sharedByLABS, additionalSeconds",
        "VALIDATION_ERROR",
      );
    }

    if (additionalSeconds <= 0) {
      return sendError(
        res,
        400,
        "additionalSeconds must be greater than 0",
        "VALIDATION_ERROR",
      );
    }

    const result = await sharingService.extendSharingExpiration(
      sharingId,
      sharedByLABS,
      additionalSeconds,
    );

    res.json(result);
  } catch (error) {
    console.error("Extend sharing expiration error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * POST /api/sharing/cleanup
 * Clean up expired sharing records (admin endpoint)
 */
router.post("/cleanup", (req, res) => {
  try {
    const result = sharingService.cleanupExpiredShares();
    res.json(result);
  } catch (error) {
    console.error("Cleanup error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

/**
 * GET /api/sharing/statistics
 * Get sharing statistics (admin endpoint)
 */
router.get("/statistics", (req, res) => {
  try {
    const result = sharingService.getStatistics();
    res.json(result);
  } catch (error) {
    console.error("Get statistics error:", error);
    return sendError(res, 400, error.message, "SHARING_ERROR");
  }
});

module.exports = router;
