import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { bytesToHex, hexToBytes } from '@/core/hash/sha256'
import '@/core/trust'

export const SHA256_OID = '2.16.840.1.101.3.4.2.1'
const ID_SIGNED_DATA = '1.2.840.113549.1.7.2'
const ID_CT_TSTINFO = '1.2.840.113549.1.9.16.1.4'
const CN_OID = '2.5.4.3'
const HASH_NAMES: Record<string, string> = {
  [SHA256_OID]: 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
}

export type TsaErrorCode = 'rejected' | 'malformed' | 'network' | 'timeout' | 'mismatch'

export class TsaError extends Error {
  readonly code: TsaErrorCode
  constructor(code: TsaErrorCode, message: string) {
    super(message)
    this.name = 'TsaError'
    this.code = code
  }
}

export type TokenInfo = {
  tsa: string
  genTime: Date
  serialHex: string
  policy: string
  nonce?: bigint
  imprintHex: string
  hashAlg: string
}

export type TsaResult = { token: Uint8Array; info: TokenInfo }

export function randomNonce(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  bytes[0] &= 0x7f // keep it positive and non-zero-padded in DER
  bytes[0] |= 0x01
  return BigInt('0x' + bytesToHex(bytes))
}

export function buildTimeStampReq(sha256Hex: string, nonce: bigint): Uint8Array {
  const req = new pkijs.TimeStampReq({
    version: 1,
    messageImprint: new pkijs.MessageImprint({
      hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: SHA256_OID, algorithmParams: new asn1js.Null() }),
      hashedMessage: new asn1js.OctetString({ valueHex: hexToBytes(sha256Hex) }),
    }),
    nonce: asn1js.Integer.fromBigInt(nonce),
    certReq: true,
  })
  return new Uint8Array(req.toSchema().toBER())
}

export function parseTimeStampResp(der: Uint8Array): TsaResult {
  let resp: pkijs.TimeStampResp
  try {
    resp = pkijs.TimeStampResp.fromBER(der)
  } catch {
    throw new TsaError('malformed', 'La risposta del servizio di marca temporale non è valida.')
  }
  const status = resp.status.status
  if (status !== pkijs.PKIStatus.granted && status !== pkijs.PKIStatus.grantedWithMods) {
    throw new TsaError('rejected', `Richiesta di marca temporale rifiutata (stato ${status}).`)
  }
  if (!resp.timeStampToken) throw new TsaError('malformed', 'Risposta senza token di marca temporale.')
  const token = new Uint8Array(resp.timeStampToken.toSchema().toBER())
  return { token, info: parseTimeStampToken(token) }
}

/** Reads TSTInfo and the signer's common name from a TimeStampToken (CMS SignedData). */
export function parseTimeStampToken(token: Uint8Array): TokenInfo {
  try {
    const signed = signedDataOf(token)
    const tst = tstInfoOf(signed)
    const imprint = tst.messageImprint
    return {
      tsa: signerName(signed),
      genTime: tst.genTime,
      serialHex: bytesToHex(tst.serialNumber.valueBlock.valueHexView),
      policy: tst.policy,
      nonce: tst.nonce?.toBigInt(),
      imprintHex: bytesToHex(imprint.hashedMessage.valueBlock.valueHexView),
      hashAlg: HASH_NAMES[imprint.hashAlgorithm.algorithmId] ?? imprint.hashAlgorithm.algorithmId,
    }
  } catch (err) {
    if (err instanceof TsaError) throw err
    throw new TsaError('malformed', 'Token di marca temporale non leggibile.')
  }
}

export function signedDataOf(token: Uint8Array): pkijs.SignedData {
  const info = pkijs.ContentInfo.fromBER(token)
  if (info.contentType !== ID_SIGNED_DATA) throw new TsaError('malformed', 'Il token non è un SignedData CMS.')
  return new pkijs.SignedData({ schema: info.content })
}

export function tstInfoOf(signed: pkijs.SignedData): pkijs.TSTInfo {
  const encap = signed.encapContentInfo
  if (encap.eContentType !== ID_CT_TSTINFO || !encap.eContent) {
    throw new TsaError('malformed', 'Il token non contiene un TSTInfo.')
  }
  return pkijs.TSTInfo.fromBER(encap.eContent.getValue())
}

export function commonName(name: pkijs.RelativeDistinguishedNames): string {
  const cn = name.typesAndValues.find((tv) => tv.type === CN_OID)
  return cn ? String(cn.value.valueBlock.value) : ''
}

export function signerCertificate(signed: pkijs.SignedData): pkijs.Certificate | undefined {
  const sid = signed.signerInfos[0]?.sid
  const certs = (signed.certificates ?? []).filter((c): c is pkijs.Certificate => c instanceof pkijs.Certificate)
  if (sid instanceof pkijs.IssuerAndSerialNumber) {
    return certs.find((c) => c.serialNumber.isEqual(sid.serialNumber) && c.issuer.isEqual(sid.issuer))
  }
  return certs[0]
}

function signerName(signed: pkijs.SignedData): string {
  const cert = signerCertificate(signed)
  return cert ? commonName(cert.subject) : 'Autorità di marca temporale sconosciuta'
}
