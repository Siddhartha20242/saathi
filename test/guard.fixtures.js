// Made-up pages for testing the guard's rules. They are written to resemble what scam pages and
// ordinary pages look like to the rules, so they show the rules behave as intended; they are not a
// measure of how many real scams would be caught.

const f = (type, label = '', extra = {}) => ({ type, label, ...extra });

export const SCAMS = [
  { name: 'fake bank KYC page', want: 'stop', page: { host: 'nabilbank-kyc-update.top', protocol: 'https:', title: 'Nabil Bank - Update your KYC', text: 'Your account will be blocked within 24 hours. Verify your account now.', fields: [f('text', 'Customer ID'), f('password', 'Password'), f('text', 'One-time code (OTP)')] } },
  { name: 'typo address', want: 'stop', page: { host: 'nabi1bank.com', protocol: 'https:', title: 'Nabil Bank Internet Banking', text: 'Welcome. Please sign in.', fields: [f('password', 'Password')] } },
  { name: 'wallet lucky draw', want: 'stop', page: { host: 'esewa-bonus.xyz', protocol: 'https:', title: 'eSewa Lucky Draw', text: 'You have won a lottery prize. Claim immediately.', fields: [f('tel', 'Mobile'), f('text', 'Enter OTP')] } },
  { name: 'remote support scam', want: 'stop', page: { host: 'support-help-desk.top', protocol: 'https:', title: 'Your computer has a virus', text: 'URGENT warning. Your computer will be blocked immediately. Call now and install AnyDesk so our technician can fix it.', fields: [] } },
  { name: 'tax refund sending data elsewhere', want: 'stop', page: { host: 'refund-portal.top', protocol: 'https:', title: 'Income Tax Department Refund', text: 'Claim your refund.', fields: [f('text', 'Card number')], formHosts: ['collect.evil-pay.net'] } },
  { name: 'Hindi KYC scam', want: 'stop', page: { host: 'paytm-kyc.in.net', protocol: 'https:', title: 'Paytm KYC', text: 'आपका खाता बंद हो जाएगा। तुरंत केवाईसी करें।', fields: [f('text', 'ओटीपी')] } },
  { name: 'fake bank on an IP address over http', want: 'stop', page: { host: '203.0.113.7', protocol: 'http:', title: 'Himal Bank Login', text: 'Sign in', fields: [f('password', 'Password')] } },
  { name: 'passport lookalike', want: 'stop', page: { host: 'nepalpassport-gov.com', protocol: 'https:', title: 'Department of Passports - Apply', text: 'Apply for your passport', fields: [f('password', 'Password')] } },
  { name: 'real name hidden in a longer address', want: 'stop', page: { host: 'login.nabilbank.com.verify-secure.top', protocol: 'https:', title: 'Nabil Bank Login', text: 'Sign in to your account', fields: [f('password', 'Password')] } },
  { name: 'cashback offer', want: 'stop', page: { host: 'bkash-cashback.top', protocol: 'https:', title: 'bKash Cashback Offer', text: 'Claim now immediately.', fields: [f('tel', 'Number'), f('text', 'PIN')] } },
  { name: 'train refund', want: 'stop', page: { host: 'irctc-refund.co.in', protocol: 'https:', title: 'IRCTC Refund', text: 'Get your refund', fields: [f('text', 'ATM PIN')] } },
  { name: 'prize fee by gift card', want: 'careful', page: { host: 'win-prize.click', protocol: 'https:', title: 'Congratulations winner', text: 'You have won a prize. Pay the processing fee by gift card immediately.', fields: [] } },
];

export const ORDINARY = [
  { name: 'the real bank login', want: 'ok', page: { host: 'ebanking.nabilbank.com', protocol: 'https:', title: 'Nabil Bank Internet Banking', text: 'Sign in to your account.', fields: [f('password', 'Password'), f('text', 'One-time code (OTP)')] } },
  { name: 'Wikipedia article about a bank', want: 'ok', page: { host: 'en.wikipedia.org', protocol: 'https:', title: 'Nabil Bank - Wikipedia', text: 'Nabil Bank is a bank in Nepal.', fields: [f('search', 'Search Wikipedia')] } },
  { name: 'python.org', want: 'ok', page: { host: 'www.python.org', protocol: 'https:', title: 'Welcome to Python.org', text: 'Python is a programming language.', fields: [f('search', 'Search')] } },
  { name: 'GitHub sign-in', want: 'ok', page: { host: 'github.com', protocol: 'https:', title: 'Sign in to GitHub', text: 'Username or email address. Password.', fields: [f('text', 'Username or email address'), f('password', 'Password')] } },
  { name: 'Google sign-in', want: 'ok', page: { host: 'accounts.google.com', protocol: 'https:', title: 'Sign in - Google Accounts', text: 'Sign in with your Google Account.', fields: [f('password', 'Enter your password')] } },
  { name: 'the remote-support tool\'s own site', want: 'ok', page: { host: 'anydesk.com', protocol: 'https:', title: 'AnyDesk - Remote Desktop Software', text: 'Download AnyDesk for remote access.', fields: [] } },
  { name: 'electricity authority home', want: 'ok', page: { host: 'www.nea.org.np', protocol: 'https:', title: 'Nepal Electricity Authority', text: 'Consumer services and tenders.', fields: [f('search', 'Search')] } },
  { name: 'tax department login on its real address', want: 'ok', page: { host: 'taxpayerportal.ird.gov.np', protocol: 'https:', title: 'Inland Revenue Department - Login', text: 'Taxpayer login.', fields: [f('password', 'Password')] } },
  { name: 'shop checkout with card fields', want: 'ok', page: { host: 'someshop.com.np', protocol: 'https:', title: 'Checkout', text: 'Pay for your order.', fields: [f('text', 'Card number'), f('text', 'CVV')], formHosts: ['someshop.com.np'] } },
  { name: 'the real wallet login', want: 'ok', page: { host: 'esewa.com.np', protocol: 'https:', title: 'eSewa - Login', text: 'Sign in.', fields: [f('tel', 'Mobile'), f('text', 'OTP')] } },
  { name: 'blog post that mentions a wallet', want: 'ok', page: { host: 'myblog.com', protocol: 'https:', title: 'How I learned about Khalti payments', text: 'A short story about paying bills.', fields: [] } },
  { name: 'practice website', want: 'ok', page: { host: 'paperwork-decoder.web.app', protocol: 'https:', title: 'Pay your bill (practice)', text: 'Customer ID. Branch office.', fields: [f('text', 'Customer ID'), f('select', 'Branch office')] } },
  { name: 'news story about phishing (a known gentle false alarm)', want: 'careful', page: { host: 'kathmandupost.com', protocol: 'https:', title: 'Fake eSewa pages cheat users', text: 'Scammers say your account will be blocked and ask for a KYC update immediately.', fields: [] } },
  { name: 'old school portal still on http (genuinely not secure)', want: 'careful', page: { host: 'localschool.edu.np', protocol: 'http:', title: 'School portal', text: 'Log in to see results.', fields: [f('password', 'Password')] } },
];
