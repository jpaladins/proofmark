// Test-only RFC 3161 authority: a self-signed root and a TSA leaf that sign real TSTInfo tokens,
// so seal/verification code can be exercised for arbitrary hashes without the network.
import * as asn1js from 'asn1js'
import * as pkijs from 'pkijs'
import { hexToBytes } from '@/core/hash/sha256'
import { SHA256_OID } from '@/core/tsa/rfc3161'
import '@/core/trust'

const ALG = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
const cn = (value: string) =>
  new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value }) })

async function makeCert(opts: {
  serial: number
  subject: string
  issuer: string
  keys: CryptoKeyPair
  signer: CryptoKey
  ca: boolean
  eku?: boolean
}) {
  const cert = new pkijs.Certificate()
  cert.version = 2
  cert.serialNumber = new asn1js.Integer({ value: opts.serial })
  cert.issuer.typesAndValues.push(cn(opts.issuer))
  cert.subject.typesAndValues.push(cn(opts.subject))
  cert.notBefore.value = new Date(Date.now() - 86_400_000)
  cert.notAfter.value = new Date(Date.now() + 10 * 365 * 86_400_000)
  cert.extensions = [
    new pkijs.Extension({
      extnID: '2.5.29.19',
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: opts.ca }).toSchema().toBER(false),
      parsedValue: new pkijs.BasicConstraints({ cA: opts.ca }),
    }),
    ...(opts.eku
      ? [
          new pkijs.Extension({
            extnID: '2.5.29.37',
            critical: true,
            extnValue: new pkijs.ExtKeyUsage({ keyPurposes: ['1.3.6.1.5.5.7.3.8'] }).toSchema().toBER(false),
            parsedValue: new pkijs.ExtKeyUsage({ keyPurposes: ['1.3.6.1.5.5.7.3.8'] }),
          }),
        ]
      : []),
  ]
  await cert.subjectPublicKeyInfo.importKey(opts.keys.publicKey)
  await cert.sign(opts.signer, 'SHA-256')
  return cert
}

function toPem(cert: pkijs.Certificate): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(cert.toSchema().toBER(false))))
  return `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`
}

export async function makeTestTsa({ eku = true }: { eku?: boolean } = {}): Promise<{
  trustPem: string
  seen: string[]
  timestamp(sha256Hex: string): Promise<{ token: Uint8Array<ArrayBuffer> }>
}> {
  const rootKeys = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair
  const leafKeys = (await crypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as CryptoKeyPair
  const root = await makeCert({ serial: 1, subject: 'Test Root', issuer: 'Test Root', keys: rootKeys, signer: rootKeys.privateKey, ca: true })
  const leaf = await makeCert({ serial: 2, subject: 'Test TSA', issuer: 'Test Root', keys: leafKeys, signer: rootKeys.privateKey, ca: false, eku })
  const seen: string[] = []
  let serial = 100

  return {
    trustPem: toPem(root),
    seen,
    async timestamp(sha256Hex: string) {
      seen.push(sha256Hex)
      const tst = new pkijs.TSTInfo({
        version: 1,
        policy: '1.2.3.4',
        messageImprint: new pkijs.MessageImprint({
          hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: SHA256_OID }),
          hashedMessage: new asn1js.OctetString({ valueHex: hexToBytes(sha256Hex) }),
        }),
        serialNumber: new asn1js.Integer({ value: serial++ }),
        genTime: new Date(),
      })
      const tstDer = tst.toSchema().toBER(false)
      const digest = await crypto.subtle.digest('SHA-256', tstDer)
      const signed = new pkijs.SignedData({
        version: 3,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({
          eContentType: '1.2.840.113549.1.9.16.1.4',
          eContent: new asn1js.OctetString({ valueHex: tstDer }),
        }),
        signerInfos: [
          new pkijs.SignerInfo({
            version: 1,
            sid: new pkijs.IssuerAndSerialNumber({ issuer: leaf.issuer, serialNumber: leaf.serialNumber }),
            signedAttrs: new pkijs.SignedAndUnsignedAttributes({
              type: 0,
              attributes: [
                new pkijs.Attribute({
                  type: '1.2.840.113549.1.9.3',
                  values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.9.16.1.4' })],
                }),
                new pkijs.Attribute({ type: '1.2.840.113549.1.9.4', values: [new asn1js.OctetString({ valueHex: digest })] }),
              ],
            }),
          }),
        ],
        certificates: [leaf, root],
      })
      await signed.sign(leafKeys.privateKey, 0, 'SHA-256')
      const token = new pkijs.ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: signed.toSchema(true) })
      return { token: new Uint8Array(token.toSchema().toBER(false)) }
    },
  }
}
