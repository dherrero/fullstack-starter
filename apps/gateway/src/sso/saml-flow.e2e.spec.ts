import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { SignedXml } from 'xml-crypto';
import { generateKeyPairSync, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@dto';

// The api boundary is mocked so this e2e needs no Postgres/api: it exercises
// the REAL SAML SP of the gateway (AuthnRequest generation, full POST-binding
// Response validation via @node-saml/node-saml, transaction cookie binding,
// InResponseTo, NameID policy, domain allowlist) against XML we sign here with
// a throwaway test IdP key — plus a full attack suite. No external network.
vi.mock('@gateway/clients/api.client', () => ({
  ApiClient: {
    resolveFederatedUser: vi.fn().mockResolvedValue({
      id: 42,
      email: 'alice@corp.com',
      permissions: [Permission.WRITE_SOME_ENTITY],
    }),
    recordRefresh: vi.fn().mockResolvedValue({ recorded: true }),
  },
}));

import { ApiClient } from '@gateway/clients/api.client';
import authRouter from '@gateway/routes/auth.routes';
import { resetSamlClientCaches } from '@gateway/sso/saml-client';
import { resetSamlRegistryCache } from '@gateway/sso/saml-provider-registry';

const SP_ENTITY = 'https://app.example.com';
const IDP_ISSUER = 'https://idp.e2e.example/metadata';
const IDP_ENTRY = 'https://idp.e2e.example/sso';
const ACS = 'https://app.example.com/api/v1/auth/sso/test/callback';

const SAML_NS = 'urn:oasis:names:tc:SAML:2.0:assertion';
const SAMLP_NS = 'urn:oasis:names:tc:SAML:2.0:protocol';
const PERSISTENT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent';

// --- Throwaway test IdP key + self-signed cert (generated at suite start,
//     never persisted, never reused outside this spec). -----------------------
let IDP_KEY = '';
let IDP_CERT = '';
// A second, unrelated key — used to forge signatures the SP must reject.
let ROGUE_KEY = '';

const makeSelfSignedCert = (): { key: string; cert: string } => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const dir = mkdtempSync(join(tmpdir(), 'saml-e2e-'));
  const keyPath = join(dir, 'k.pem');
  const certPath = join(dir, 'c.pem');
  writeFileSync(keyPath, keyPem);
  // openssl is available on the dev/CI image; build a long-lived x509.
  execFileSync('openssl', [
    'req',
    '-x509',
    '-new',
    '-key',
    keyPath,
    '-out',
    certPath,
    '-days',
    '27000',
    '-subj',
    '/CN=e2e-test-idp',
    '-sha256',
  ]);
  const cert = new X509Certificate(
    execFileSync('cat', [certPath]).toString(),
  ).toString();
  return { key: keyPem, cert };
};

let app: Express;

// --- Minimal SAML IdP harness: builds and signs Responses/Assertions. --------
interface BuildOpts {
  requestId: string;
  nameId?: string;
  nameIdFormat?: string;
  email?: string;
  groups?: string[];
  audience?: string;
  issuer?: string;
  notOnOrAfter?: string;
  signAssertion?: boolean;
  signResponse?: boolean;
  signKey?: string;
  signCert?: string;
  // XSW: inject a second, unsigned assertion alongside the signed one.
  xswSecondAssertion?: boolean;
  // comment injection in the NameID (CVE-2017-11427 class).
  nameIdComment?: boolean;
}

const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
let idCounter = 0;
const uid = (p: string) => `_${p}${(idCounter += 1)}${'0'.repeat(20)}`;

const signElement = (
  xml: string,
  refId: string,
  key: string,
  cert: string,
): string => {
  const sig = new SignedXml({ privateKey: key, publicCert: cert });
  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
  sig.addReference({
    xpath: `//*[@ID='${refId}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.computeSignature(xml, {
    location: {
      reference: `//*[@ID='${refId}']/*[local-name()='Issuer']`,
      action: 'after',
    },
  });
  return sig.getSignedXml();
};

const buildAssertion = (o: BuildOpts, assertionId: string): string => {
  const nameId = o.nameIdComment
    ? `alice@corp.com<!---->.evil.com`
    : (o.nameId ?? 'persistent-user-123');
  const after = o.notOnOrAfter ?? iso(5 * 60_000);
  const audience = o.audience ?? SP_ENTITY;
  const issuer = o.issuer ?? IDP_ISSUER;
  const email = o.email ?? 'alice@corp.com';
  const groups = o.groups ?? ['admins'];
  return (
    `<saml:Assertion xmlns:saml="${SAML_NS}" ID="${assertionId}" Version="2.0" IssueInstant="${iso()}">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<saml:Subject><saml:NameID Format="${o.nameIdFormat ?? PERSISTENT}">${nameId}</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData NotOnOrAfter="${after}" Recipient="${ACS}" InResponseTo="${o.requestId}"/>` +
    `</saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotBefore="${iso(-60_000)}" NotOnOrAfter="${after}">` +
    `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>` +
    `</saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${iso()}" SessionIndex="sess-e2e">` +
    `<saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef></saml:AuthnContext>` +
    `</saml:AuthnStatement>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="groups">${groups
      .map((g) => `<saml:AttributeValue>${g}</saml:AttributeValue>`)
      .join('')}</saml:Attribute>` +
    `</saml:AttributeStatement></saml:Assertion>`
  );
};

/** Builds a base64 SAMLResponse per the options, signing as requested. */
const buildResponse = (o: BuildOpts): string => {
  const signAssertion = o.signAssertion ?? true;
  const signResponse = o.signResponse ?? true;
  const key = o.signKey ?? IDP_KEY;
  const cert = o.signCert ?? IDP_CERT;
  const responseId = uid('resp');
  const assertionId = uid('assn');

  let assertion = buildAssertion(o, assertionId);
  if (signAssertion) assertion = signElement(assertion, assertionId, key, cert);

  // XSW: prepend a forged unsigned assertion with attacker NameID, keeping the
  // legitimately-signed one elsewhere in the tree.
  const forged = o.xswSecondAssertion
    ? buildAssertion({ ...o, nameId: 'attacker-evil' }, uid('forged'))
    : '';

  let response =
    `<samlp:Response xmlns:samlp="${SAMLP_NS}" xmlns:saml="${SAML_NS}" ID="${responseId}" Version="2.0" IssueInstant="${iso()}" Destination="${ACS}" InResponseTo="${o.requestId}">` +
    `<saml:Issuer>${o.issuer ?? IDP_ISSUER}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    forged +
    assertion +
    `</samlp:Response>`;

  if (signResponse) response = signElement(response, responseId, key, cert);
  return Buffer.from(response).toString('base64');
};

const cookieHeader = (setCookie: string[] | undefined): string =>
  (setCookie ?? []).map((c) => c.split(';')[0]).join('; ');

const buildApp = (): Express => {
  const a = express();
  a.use(cookieParser());
  a.use('/api/v1/auth', authRouter);
  return a;
};

/** Start login, returning the AuthnRequest id and the transaction cookie. */
const startLogin = async (): Promise<{ requestId: string; cookie: string }> => {
  const res = await request(app).get(
    '/api/v1/auth/sso/test/login?returnTo=/dashboard',
  );
  expect(res.status).toBe(302);
  const url = new URL(res.headers.location);
  const raw = url.searchParams.get('SAMLRequest') as string;
  const { inflateRawSync } = await import('node:zlib');
  const xml = inflateRawSync(Buffer.from(raw, 'base64')).toString('utf8');
  const requestId = /ID="([^"]+)"/.exec(xml)?.[1] as string;
  return { requestId, cookie: cookieHeader(res.headers['set-cookie']) };
};

const postToAcs = (samlResponse: string, cookie: string) =>
  request(app)
    .post('/api/v1/auth/sso/test/callback')
    .set('Cookie', cookie)
    .type('form')
    .send({ SAMLResponse: samlResponse });

describe('SAML SP flow (e2e against a self-signed test IdP)', () => {
  beforeAll(() => {
    const idp = makeSelfSignedCert();
    IDP_KEY = idp.key;
    IDP_CERT = idp.cert;
    ROGUE_KEY = makeSelfSignedCert().key;

    process.env.SSO_ALLOW_INSECURE_ISSUERS = 'true'; // https public host anyway
    process.env.SAML_TEST_ENTRY_POINT = IDP_ENTRY;
    process.env.SAML_TEST_IDP_ISSUER = IDP_ISSUER;
    process.env.SAML_TEST_IDP_CERT = IDP_CERT.replace(/\n/g, '\\n');
    process.env.SAML_TEST_CALLBACK_URL = ACS;
    process.env.SAML_TEST_SP_ISSUER = SP_ENTITY;
    process.env.SAML_TEST_PERMISSION_MAP = 'admins:WRITE_SOME_ENTITY';
    process.env.SAML_TEST_ALLOWED_DOMAINS = 'corp.com';
    process.env.SSO_STATE_SECRET = 'e2e-state-secret';
    process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    resetSamlRegistryCache();
    resetSamlClientCaches();
    app = buildApp();
  });

  beforeEach(() => vi.clearAllMocks());

  it('happy path: login → signed Response at the ACS issues the local session', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(buildResponse({ requestId }), cookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
    expect(res.headers['authorization']).toBeTruthy();
    expect(cookieHeader(res.headers['set-cookie'])).toContain('refreshToken=');
    expect(ApiClient.resolveFederatedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'test',
        subject: 'persistent-user-123',
        email: 'alice@corp.com',
        emailVerified: true,
        suggestedPermissions: [Permission.WRITE_SOME_ENTITY],
      }),
      expect.any(String),
    );
  });

  // --- Attack suite: every case must end in rejection with no session. -------
  const expectRejected = (res: {
    status: number;
    headers: Record<string, unknown>;
  }) => {
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('/login?sso_error=1');
    expect(cookieHeader(res.headers['set-cookie'] as string[])).not.toContain(
      'refreshToken=',
    );
    expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
  };

  it('attack 1: unsigned response and assertion → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, signAssertion: false, signResponse: false }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 2: signed response but UNSIGNED assertion → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, signAssertion: false, signResponse: true }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 3: signature forged with a different (rogue) key → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, signKey: ROGUE_KEY, signCert: IDP_CERT }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 4: XML Signature Wrapping — forged assertion + valid signed one → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, xswSecondAssertion: true }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 5: comment injection in the NameID → no privilege/identity confusion', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, nameIdComment: true }),
      cookie,
    );
    // Either the library strips the comment (subject = full value, still a
    // corp.com identity) or it rejects. What must NEVER happen is resolving as
    // a different identity than the signed one. Assert no escalation to a bare
    // "alice@corp.com" subject that drops the suffix.
    if (res.headers.location === '/dashboard') {
      const arg = vi.mocked(ApiClient.resolveFederatedUser).mock.calls[0][0];
      expect(arg.subject).not.toBe('alice@corp.com');
    } else {
      expectRejected(res);
    }
  });

  it('attack 6: replay — the same valid Response twice → second rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const body = buildResponse({ requestId });
    const first = await postToAcs(body, cookie);
    expect(first.headers.location).toBe('/dashboard');
    vi.clearAllMocks();
    // Reuse the (now single-use-consumed) transaction cookie + same response.
    const second = await postToAcs(body, cookie);
    expectRejected(second);
  });

  it('attack 7: no transaction cookie (IdP-initiated) → rejected', async () => {
    const { requestId } = await startLogin();
    const res = await postToAcs(buildResponse({ requestId }), '');
    expectRejected(res);
  });

  it('attack 8: InResponseTo of a different transaction → rejected', async () => {
    const { cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId: '_someone-elses-request-000000000' }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 9: AudienceRestriction for another SP → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, audience: 'https://other-sp.example' }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 10: expired assertion (NotOnOrAfter in the past) → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, notOnOrAfter: iso(-10 * 60_000) }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 11: Issuer of a different IdP (mix-up) → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, issuer: 'https://evil-idp.example/metadata' }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 12: email domain outside the allowlist → rejected', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({ requestId, email: 'victim@othertenant.com' }),
      cookie,
    );
    expectRejected(res);
  });

  it('attack 13: RelayState with an external URL is NEVER followed', async () => {
    const { requestId, cookie } = await startLogin();
    // A hostile IdP (or a MitM on the POST) sets RelayState to an external
    // origin. The final redirect must come from the signed transaction cookie
    // (returnTo=/dashboard), never from RelayState.
    const res = await request(app)
      .post('/api/v1/auth/sso/test/callback')
      .set('Cookie', cookie)
      .type('form')
      .send({
        SAMLResponse: buildResponse({ requestId }),
        RelayState: 'https://evil.example/phish',
      });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
  });

  it('attack 14: transient NameID format → rejected (unstable identity)', async () => {
    const { requestId, cookie } = await startLogin();
    const res = await postToAcs(
      buildResponse({
        requestId,
        nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
        nameId: '_one-time-opaque-handle',
      }),
      cookie,
    );
    expectRejected(res);
  });
});
