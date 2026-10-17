import * as pkijs from 'pkijs'
import type { Bytes } from '@/core/hash/sha256'
import { certificateFromPem, DIGICERT_ROOT_G4 } from '@/core/trust'
import { parseTimeStampToken, signedDataOf, signerCertificate } from '@/core/tsa/rfc3161'

export type CheckId = 'hash' | 'imprint' | 'signature' | 'chain' | 'meta' | 'ots-hash' | 'bitcoin' | 'pdf-seal'
export type Check = { id: CheckId; status: 'ok' | 'warn' | 'fail'; label: string; detail?: string }

/** Offline verification of an RFC 3161 token: covered hash, CMS signature, and chain to the pinned root. */
export async function verifyTimestampToken(
  token: Bytes,
  expectedSha256Hex: string,
  opts: { trustPem?: string } = {},
): Promise<Check[]> {
  let signed: pkijs.SignedData
  let genTime: Date
  try {
    signed = signedDataOf(token)
    const info = parseTimeStampToken(token)
    genTime = info.genTime
    const imprintOk = info.imprintHex === expectedSha256Hex.toLowerCase()
    const checks: Check[] = [
      imprintOk
        ? { id: 'imprint', status: 'ok', label: "Il token di marca temporale copre l'impronta dell'archivio" }
        : {
            id: 'imprint',
            status: 'fail',
            label: "L'impronta del token non corrisponde all'archivio",
            detail: `Token: ${info.imprintHex}`,
          },
    ]
    checks.push(await signatureCheck(signed))
    checks.push(await chainCheck(signed, genTime, opts.trustPem ?? DIGICERT_ROOT_G4))
    return checks
  } catch {
    return [{ id: 'imprint', status: 'fail', label: 'Token di marca temporale non leggibile' }]
  }
}

const ID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4'
const DIGESTS: Record<string, string> = {
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
}

/**
 * Verifies the CMS signature of a timestamp token. pkijs' SignedData.verify insists on the
 * original data for TSTInfo content, but here only the hash is known (the imprint check covers
 * it), so the signed-attributes path is reproduced directly: messageDigest must equal the digest
 * of the TSTInfo, and the signature must verify over the DER-encoded signed attributes.
 */
async function signatureCheck(signed: pkijs.SignedData): Promise<Check> {
  const fail: Check = { id: 'signature', status: 'fail', label: 'Firma della marca temporale non valida' }
  try {
    const signerInfo = signed.signerInfos[0]
    const cert = signerCertificate(signed)
    const hashName = DIGESTS[signerInfo.digestAlgorithm.algorithmId]
    const eContent = signed.encapContentInfo.eContent
    if (!cert || !hashName || !eContent || !signerInfo.signedAttrs) return fail
    const digestAttr = signerInfo.signedAttrs.attributes.find((a) => a.type === ID_MESSAGE_DIGEST)
    if (!digestAttr) return fail
    const declared = new Uint8Array(digestAttr.values[0].valueBlock.valueHexView)
    const actual = new Uint8Array(await crypto.subtle.digest(hashName, eContent.getValue()))
    if (declared.length !== actual.length || declared.some((b, i) => b !== actual[i])) return fail
    const ok = await pkijs
      .getCrypto(true)
      .verifyWithPublicKey(
        signerInfo.signedAttrs.encodedValue,
        signerInfo.signature,
        cert.subjectPublicKeyInfo,
        signerInfo.signatureAlgorithm,
        hashName,
      )
    return ok ? { id: 'signature', status: 'ok', label: 'Firma della marca temporale valida' } : fail
  } catch {
    return fail
  }
}

const EKU_OID = '2.5.29.37'
const KP_TIME_STAMPING = '1.3.6.1.5.5.7.3.8'

/** RFC 3161 §2.3: the TSA certificate must carry a critical extendedKeyUsage of exactly id-kp-timeStamping. */
function isTimeStampingCert(cert: pkijs.Certificate): boolean {
  const ext = cert.extensions?.find((e) => e.extnID === EKU_OID)
  if (!ext?.critical) return false
  const eku = ext.parsedValue instanceof pkijs.ExtKeyUsage ? ext.parsedValue : undefined
  const purposes = eku?.keyPurposes ?? []
  return purposes.length === 1 && purposes[0] === KP_TIME_STAMPING
}

async function chainCheck(signed: pkijs.SignedData, at: Date, trustPem: string): Promise<Check> {
  const fail: Check = { id: 'chain', status: 'fail', label: 'Catena di certificati non attendibile' }
  try {
    const root = certificateFromPem(trustPem)
    const leaf = signerCertificate(signed)
    if (!leaf) return fail
    if (!isTimeStampingCert(leaf)) {
      return { ...fail, label: 'Il certificato del firmatario non è abilitato alle marche temporali' }
    }
    // DigiCert also ships a cross-certificate for G4 issued by an older root; drop it so the
    // chain terminates at the pinned self-signed anchor.
    const intermediates = (signed.certificates ?? []).filter(
      (c): c is pkijs.Certificate =>
        c instanceof pkijs.Certificate && c !== leaf && !(c.subject.isEqual(root.subject) && !c.issuer.isEqual(c.subject)),
    )
    const engine = new pkijs.CertificateChainValidationEngine({
      trustedCerts: [root],
      certs: [...intermediates, leaf],
      checkDate: at,
    })
    const result = await engine.verify()
    if (result.result) {
      return {
        id: 'chain',
        status: 'ok',
        label: `Certificato dell'autorità riconducibile a DigiCert Trusted Root G4`,
      }
    }
    return { ...fail, detail: result.resultMessage }
  } catch (err) {
    return { ...fail, detail: err instanceof Error ? err.message : String(err) }
  }
}
