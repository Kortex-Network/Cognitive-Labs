const fc = require("fast-check");
const {
  validateSchema,
  encodeDeepLink,
  decodeDeepLink,
  generateToken,
  validateToken,
} = require("../services/qrService");

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbitraryLABSPayload = () =>
  fc.record({
    type: fc.constant("LABS"),
    LABS: fc
      .string({ minLength: 1, maxLength: 64 })
      .filter((s) => s.trim().length > 0),
  });

const arbitraryCredentialPayload = () =>
  fc.record({
    type: fc.constant("credential"),
    credentialId: fc
      .string({ minLength: 1, maxLength: 64 })
      .filter((s) => s.trim().length > 0),
  });

const arbitraryConnectionPayload = () =>
  fc.record({
    type: fc.constant("connection"),
    publicKey: fc
      .string({ minLength: 1, maxLength: 128 })
      .filter((s) => s.trim().length > 0),
  });

const arbitraryQRPayload = () =>
  fc.oneof(
    arbitraryLABSPayload(),
    arbitraryCredentialPayload(),
    arbitraryConnectionPayload(),
  );

const arbitraryInvalidPayload = () =>
  fc.oneof(
    // missing type
    fc.record({ LABS: fc.string({ minLength: 1 }) }),
    // wrong type
    fc.record({
      type: fc
        .string({ minLength: 1 })
        .filter((s) => !["LABS", "credential", "connection"].includes(s)),
    }),
    // LABS type missing LABS field
    fc.record({ type: fc.constant("LABS") }),
    // credential type missing credentialId
    fc.record({ type: fc.constant("credential") }),
    // connection type missing publicKey
    fc.record({ type: fc.constant("connection") }),
  );

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("validateSchema", () => {
  test("accepts valid LABS payload", () => {
    expect(validateSchema({ type: "LABS", LABS: "LABS:stellar:abc" })).toEqual({
      valid: true,
      errors: [],
    });
  });

  test("accepts valid credential payload", () => {
    expect(
      validateSchema({ type: "credential", credentialId: "cred-123" }),
    ).toEqual({ valid: true, errors: [] });
  });

  test("accepts valid connection payload", () => {
    expect(
      validateSchema({ type: "connection", publicKey: "GABC..." }),
    ).toEqual({ valid: true, errors: [] });
  });

  test("rejects missing type", () => {
    const result = validateSchema({ LABS: "LABS:stellar:abc" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects unknown type", () => {
    const result = validateSchema({ type: "unknown" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("type");
  });

  test("rejects null/undefined", () => {
    expect(validateSchema(null).valid).toBe(false);
    expect(validateSchema(undefined).valid).toBe(false);
  });
});

describe("encodeDeepLink / decodeDeepLink", () => {
  test("round-trips a LABS payload", () => {
    const payload = { type: "LABS", LABS: "LABS:stellar:abc" };
    expect(decodeDeepLink(encodeDeepLink(payload))).toEqual(payload);
  });

  test("URI starts with LABS-marketplace://qr?payload=", () => {
    const uri = encodeDeepLink({ type: "LABS", LABS: "x" });
    expect(uri.startsWith("LABS-marketplace://qr?payload=")).toBe(true);
  });

  test("decodeDeepLink throws on missing payload param", () => {
    expect(() => decodeDeepLink("LABS-marketplace://qr")).toThrow();
  });
});

describe("generateToken / validateToken", () => {
  test("generates and validates a token round-trip", () => {
    const payload = { type: "LABS", LABS: "LABS:stellar:abc" };
    const { token } = generateToken(payload);
    const decoded = validateToken(token);
    expect(decoded.type).toBe("LABS");
    expect(decoded.LABS).toBe("LABS:stellar:abc");
  });

  test("generateToken throws on invalid payload", () => {
    expect(() => generateToken({ type: "unknown" })).toThrow();
  });

  test("validateToken throws on tampered token", () => {
    const { token } = generateToken({ type: "LABS", LABS: "x" });
    expect(() => validateToken(token + "tampered")).toThrow();
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("Property 1: QR Payload Round-Trip", () => {
  test("decodeDeepLink(encodeDeepLink(payload)) deep-equals original", () => {
    fc.assert(
      fc.property(arbitraryQRPayload(), (payload) => {
        const roundTripped = decodeDeepLink(encodeDeepLink(payload));
        expect(roundTripped).toEqual(payload);
      }),
    );
  });
});

describe("Property 2: Invalid Payload Produces Structured Errors", () => {
  test("validateSchema returns valid:false with non-empty errors array", () => {
    fc.assert(
      fc.property(arbitraryInvalidPayload(), (payload) => {
        const result = validateSchema(payload);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        result.errors.forEach((e) => {
          expect(e).toHaveProperty("field");
          expect(e).toHaveProperty("reason");
        });
      }),
    );
  });
});

describe("Property 5: Deep Link URI Format", () => {
  test("URI starts with scheme and decoded param equals original payload", () => {
    fc.assert(
      fc.property(arbitraryQRPayload(), (payload) => {
        const uri = encodeDeepLink(payload);
        expect(uri.startsWith("LABS-marketplace://qr?payload=")).toBe(true);
        const decoded = decodeDeepLink(uri);
        expect(decoded).toEqual(payload);
      }),
    );
  });
});
