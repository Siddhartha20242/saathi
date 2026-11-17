// Controls on real public pages, and what a redesign might rename them to.
// Each case is run on its own: the control is renamed (with its link address and name removed,
// so only the on-device model can find it) or hidden, then the guide is asked to find it.
//   variant 'renamed' : the right answer is the renamed control
//   variant 'removed' : the control is gone, so the right answer is "not sure"
// Labels are chosen to be unique on the page, so a control that is renamed has no twin that still
// carries its old label. Nothing is typed, clicked or submitted. Changes are made in the open page only and undone after.

export const PAGES = {
  wiki: 'https://en.wikipedia.org/wiki/Main_Page',
  py: 'https://www.python.org/',
  nea: 'https://www.nea.org.np/',
  bd: 'https://bangladesh.gov.bd/index.php',
};

const r = (page, label, renamed, role = 'link') => ({ page, variant: 'renamed', role, label, renamed });
const x = (page, label, role = 'link') => ({ page, variant: 'removed', role, label });

export const CASES = [
  // English: the model can read these.
  r('wiki', 'Donate', 'Support us'),
  r('wiki', 'Create account', 'Sign up'),
  r('wiki', 'Log in', 'Sign in'),
  r('wiki', 'Talk', 'Discussion'),
  r('wiki', 'View history', 'Revision log'),
  r('wiki', 'Search', 'Find', 'button'),
  x('wiki', 'Donate'),
  x('wiki', 'Talk'),

  r('py', 'PSF', 'Python Software Foundation'),
  r('py', 'PyPI', 'Package index'),
  r('py', 'Jobs', 'Careers'),
  r('py', 'Donate', 'Support us'),
  r('py', 'More news', 'See all announcements'),
  x('py', 'Socialize'),

  r('nea', 'ABOUT', 'Who we are'),
  r('nea', 'MEDIA', 'Press'),
  r('nea', 'CAREERS', 'Jobs'),
  r('nea', 'TENDERS', 'Procurement notices'),
  x('nea', 'NEA ANNIVERSARY'),

  // Bengali: the on-device model does not read Bengali. Measures how it behaves when it cannot.
  r('bd', 'ই-সেবাসমূহ', 'সকল সেবা'),
  r('bd', 'সেবাখাত', 'খাতভিত্তিক তথ্য'),
  r('bd', 'অনুসন্ধান', 'খুঁজুন', 'button'),
  x('bd', 'আইন-বিধি'),
];
