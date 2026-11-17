// Practice sites for the re-finding test. Every organisation here is made up.
// Each site is a list of controls [role, label, section], a task, and the recorded steps:
// [label when recorded, the label after the site "changed"].

const b = 'button';
const l = 'link';
const f = 'field';
const s = 'select';
const c = 'checkbox';

export const SITES = [
  {
    name: 'Himal Electricity Board',
    task: 'Pay the electricity bill',
    elements: [
      [l, 'Home', 'Menu'], [l, 'About us', 'Menu'], [l, 'Tariff rates', 'Menu'], [l, 'Notices', 'Menu'],
      [l, 'Contact', 'Menu'], [l, 'Login', 'Menu'], [b, 'Search', 'Menu'],
      [l, 'Pay your bill', 'Online services'], [l, 'New connection', 'Online services'],
      [l, 'Report an outage', 'Online services'], [l, 'Download bill', 'Online services'],
      [l, 'Payment history', 'Online services'], [l, 'Meter reading', 'Online services'],
      [f, 'Customer ID', 'Bill payment'], [s, 'Branch office', 'Bill payment'],
      [b, 'Check bill', 'Bill payment'], [b, 'Clear', 'Bill payment'],
      [b, 'Pay now', 'Bill details'], [b, 'Remind me later', 'Bill details'],
      [l, 'Download receipt', 'Bill details'], [c, 'I agree to the terms', 'Bill details'],
      [b, 'Wallet', 'Choose payment method'], [b, 'Bank transfer', 'Choose payment method'],
      [b, 'Card', 'Choose payment method'], [b, 'Cancel payment', 'Choose payment method'],
      [l, 'Privacy policy', 'Footer'], [l, 'Help centre', 'Footer'], [l, 'Complaints', 'Footer'],
    ],
    steps: [
      ['Pay your bill', 'Online bill payment'],
      ['Customer ID', 'Consumer number'],
      ['Check bill', 'View dues'],
      ['Pay now', 'Proceed to payment'],
      ['Wallet', 'Digital wallet'],
    ],
  },
  {
    name: 'Sagar Bank Online',
    task: 'Send money to another account',
    elements: [
      [l, 'Home', 'Menu'], [l, 'Accounts', 'Menu'], [l, 'Cards', 'Menu'], [l, 'Loans', 'Menu'],
      [l, 'Help', 'Menu'], [b, 'Log out', 'Menu'],
      [l, 'Send money', 'Quick actions'], [l, 'Pay bills', 'Quick actions'], [l, 'Top up mobile', 'Quick actions'],
      [l, 'Request statement', 'Quick actions'], [l, 'Open fixed deposit', 'Quick actions'],
      [f, 'Recipient account number', 'Send money'], [f, 'Recipient name', 'Send money'],
      [f, 'Amount', 'Send money'], [f, 'Remarks', 'Send money'], [s, 'Bank name', 'Send money'],
      [b, 'Continue', 'Send money'], [b, 'Save as favourite', 'Send money'], [b, 'Cancel', 'Send money'],
      [b, 'Confirm and send', 'Confirm transfer'], [b, 'Edit details', 'Confirm transfer'],
      [l, 'Transfer limits', 'Confirm transfer'],
      [l, 'Security tips', 'Footer'], [l, 'Branch locator', 'Footer'], [l, 'Contact us', 'Footer'],
    ],
    steps: [
      ['Send money', 'Fund transfer'],
      ['Recipient account number', 'Beneficiary account no.'],
      ['Amount', 'Transfer amount (NPR)'],
      ['Continue', 'Next'],
      ['Confirm and send', 'Approve transfer'],
    ],
  },
  {
    name: 'National Passport Office',
    task: 'Renew a passport',
    elements: [
      [l, 'Home', 'Menu'], [l, 'Check status', 'Menu'], [l, 'Fees', 'Menu'], [l, 'FAQs', 'Menu'],
      [l, 'Contact', 'Menu'], [s, 'Language', 'Menu'],
      [l, 'New passport application', 'Apply'], [l, 'Renew passport', 'Apply'], [l, 'Lost passport', 'Apply'],
      [l, 'Book appointment', 'Apply'], [l, 'Reschedule appointment', 'Apply'],
      [f, 'Given name', 'Applicant details'], [f, 'Surname', 'Applicant details'],
      [f, 'Date of birth', 'Applicant details'], [s, 'District', 'Applicant details'],
      [f, 'Citizenship number', 'Applicant details'], [f, 'Mobile number', 'Applicant details'],
      [f, 'Email', 'Applicant details'],
      [s, 'Office', 'Appointment'], [s, 'Date', 'Appointment'],
      [b, 'Find slots', 'Appointment'], [b, 'Book this slot', 'Appointment'],
      [c, 'I confirm the details are correct', 'Review'], [b, 'Submit application', 'Review'],
      [b, 'Save draft', 'Review'], [b, 'Print form', 'Review'],
      [l, 'Privacy notice', 'Footer'], [l, 'Accessibility', 'Footer'],
    ],
    steps: [
      ['Renew passport', 'Passport renewal'],
      ['Surname', 'Family name'],
      ['Citizenship number', 'National ID number'],
      ['Find slots', 'Show available times'],
      ['Submit application', 'Send application'],
    ],
  },
  {
    name: 'Revenue Department',
    task: 'File the yearly income tax return',
    elements: [
      [l, 'Home', 'Menu'], [l, 'Taxpayer login', 'Menu'], [l, 'Register PAN', 'Menu'], [l, 'Forms', 'Menu'],
      [l, 'Notices', 'Menu'], [l, 'Help', 'Menu'],
      [l, 'File income tax return', 'Taxpayer services'], [l, 'Pay tax', 'Taxpayer services'],
      [l, 'Verify PAN', 'Taxpayer services'], [l, 'Download tax clearance', 'Taxpayer services'],
      [l, 'Update profile', 'Taxpayer services'],
      [s, 'Fiscal year', 'Return details'], [f, 'PAN number', 'Return details'],
      [f, 'Total income', 'Return details'], [f, 'Tax deducted at source', 'Return details'],
      [b, 'Calculate tax', 'Return details'], [b, 'Reset', 'Return details'],
      [b, 'Save return', 'Submit return'], [b, 'Verify and submit', 'Submit return'],
      [l, 'Preview return', 'Submit return'], [c, 'I declare this is true', 'Submit return'],
      [l, 'Tax calendar', 'Footer'], [l, 'Office locations', 'Footer'], [l, 'Feedback', 'Footer'],
    ],
    steps: [
      ['File income tax return', 'Submit annual tax return'],
      ['Fiscal year', 'Tax year'],
      ['Tax deducted at source', 'TDS amount'],
      ['Calculate tax', 'Compute liability'],
      ['Verify and submit', 'Final submission'],
    ],
  },
  {
    name: 'City Care Hospital',
    task: 'Book a doctor appointment',
    elements: [
      [l, 'Home', 'Menu'], [l, 'Departments', 'Menu'], [l, 'Doctors', 'Menu'], [l, 'Lab reports', 'Menu'],
      [l, 'Contact', 'Menu'], [l, 'Emergency', 'Menu'],
      [l, 'Book an appointment', 'Appointments'], [l, 'Cancel appointment', 'Appointments'],
      [l, 'My appointments', 'Appointments'], [l, 'Find a doctor', 'Appointments'],
      [f, 'Patient name', 'Patient'], [f, 'Age', 'Patient'], [s, 'Gender', 'Patient'],
      [f, 'Phone number', 'Patient'], [c, 'Returning patient', 'Patient'],
      [s, 'Department', 'Choose doctor'], [s, 'Doctor', 'Choose doctor'], [s, 'Visit date', 'Choose doctor'],
      [b, 'See times', 'Choose doctor'], [b, 'Confirm booking', 'Choose doctor'],
      [b, 'Pay at hospital', 'Payment'], [b, 'Pay online', 'Payment'], [l, 'Refund policy', 'Payment'],
      [l, 'Visiting hours', 'Footer'], [l, 'Careers', 'Footer'],
    ],
    steps: [
      ['Book an appointment', 'Schedule a visit'],
      ['Department', 'Speciality'],
      ['Visit date', 'Preferred day'],
      ['See times', 'Check availability'],
      ['Confirm booking', 'Reserve appointment'],
    ],
  },
];

const toEl = ([role, text, section]) => ({ role, text, section });

/**
 * Builds the test cases. For every recorded step, the site is changed four ways:
 *   rename  - the control keeps its place but gets a new label
 *   move    - the control keeps its label but moves to another section, and the page order is reversed
 *   both    - renamed and moved
 *   removed - the control is gone (one step per site); the right answer is "none"
 */
export function buildCases() {
  const cases = [];
  for (const site of SITES) {
    const original = site.elements.map(toEl);
    site.steps.forEach(([label, renamed], stepNo) => {
      const at = original.findIndex((e) => e.text === label);
      const step = { ...original[at] };
      const context = {
        task: site.task,
        previous: stepNo ? site.steps[stepNo - 1][0] : null,
        // Labels of the path's other steps, as recorded.
        others: site.steps.filter((_, i) => i !== stepNo).map(([other]) => other),
      };
      const otherSection = original.find((e) => e.section !== step.section && e.section !== 'Footer' && e.section !== 'Menu').section;

      const make = (kind, change) => {
        let elements = original.map((e, i) => (i === at ? { ...e, ...change } : { ...e }));
        if (kind === 'move' || kind === 'both') elements = elements.reverse();
        if (kind === 'removed') elements = elements.filter((_, i) => i !== at);
        const expected = kind === 'removed' ? 'none' : elements.findIndex((e) => e.text === (change.text ?? label));
        cases.push({ site: site.name, kind, step, context, elements, expected, newLabel: change.text ?? null });
      };

      make('rename', { text: renamed });
      make('move', { section: otherSection });
      make('both', { text: renamed, section: otherSection });
      if (stepNo === 3) make('removed', {});
    });
  }
  return cases;
}
