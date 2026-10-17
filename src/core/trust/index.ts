import * as pkijs from 'pkijs'
import rootPem from './digicertRootG4'

/** DigiCert Trusted Root G4 (SHA-256 fingerprint 55:2F:7B:DC:…:C8:99:88), pinned by scripts/make-fixtures.sh. */
export const DIGICERT_ROOT_G4: string = rootPem

const engine = new pkijs.CryptoEngine({ name: 'webcrypto', crypto: globalThis.crypto })
pkijs.setEngine('webcrypto', engine)

export function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export function certificateFromPem(pem: string): pkijs.Certificate {
  return pkijs.Certificate.fromBER(pemToDer(pem))
}
