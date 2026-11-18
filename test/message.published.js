// Scam messages written to follow the patterns that banks, police and news reports have published
// (Nepal Police Cyber Bureau and Nepali banks' warnings in 2025, CERT-In and RBI advisories in India).
// They are paraphrased, with made-up links, not copied from a real person's phone. They are a harder test
// than test/message.fixtures.js, because they were not written by the person who wrote the rules.

export const PUBLISHED_SCAMS = [
  // Cyber Bureau: fake alerts imitating wallets and payment services, sent from hijacked bulk-SMS accounts.
  { from: 'Nepal Cyber Bureau report', text: 'Your connectIPS linked accounts have been suspended due to security reasons. Please complete the self-verify process at http://connectips-verify.top to regain access.' },
  { from: 'Nepal Cyber Bureau report', text: 'Khalti Alert: your wallet is on hold. Verify within 24 hours or your balance will be frozen. Click https://khalti-secure.xyz/verify' },
  // NIC Asia and other banks: fake KYC links, account will be blocked.
  { from: 'Nepali bank warning', text: 'Dear NIC Asia customer, your KYC is incomplete and your account will be blocked today. Update here: https://nicasia-kyc.top' },
  // Festival bait: prize plus an advance "service charge".
  { from: 'Nepali news, festival fraud', text: 'Dashain dhamaka! You have won a prize. Pay the service charge of Rs 500 to claim it today: bit.ly/d4sain' },
  // Police: KYC pretext on a phone call, to obtain the OTP.
  { from: 'Nepal arrests, KYC call', text: 'Sir, we are updating KYC for your bank account. Please tell me the OTP that you just received so we can complete it.' },
  // CERT-In 2021: "account will be suspended", re-verify KYC through a link on a temporary tunnel address.
  { from: 'CERT-In advisory sample', text: 'Dear customer your SBI bank account will be suspended! Re-verify your KYC now: http://sbi-kyc.ngrok.io' },
  // HDFC phishing wave: typo "will be block", KYC pending.
  { from: 'HDFC phishing wave', text: 'Dear customer, your HDFC Bank account will be block today. KYC pending, update now: http://hdfcbank-kyc.top' },
  // Reward points expiring.
  { from: 'India bank warnings', text: 'Your HDFC Bank reward points will expire today. Redeem now: http://hdfcbank-rewards.top' },
  // Impersonating the regulator: fake RBI KYC link.
  { from: 'RBI explainer', text: 'RBI notice: your KYC update is pending. Your account will be closed in 2 hours. Update through this link: https://rbi-kyc-update.top' },
];
