// What the guard says, in English, Nepali and Hindi. Written by hand so that a warning never depends on
// a model or the network. These short sentences have not been reviewed by a native speaker yet.

export const LANGS_GUARD = ['en', 'ne', 'hi'];

const TEXT = {
  en: {
    stop: 'Stop. This page may be a scam. Do not type anything.',
    careful: 'Be careful with this page.',
    why: 'Why?',
    family: 'Tell my family',
    dismiss: 'I understand',
    sent: 'Your family has been told.',
    openPanel: 'Open Saathi (the green icon) and press "Tell my family" there.',
    reasons: {
      lookalike: 'The address looks like {brand}, but it is spelled differently.',
      pretends: 'This page says it is {brand}, but its address is not {brand}.',
      asksSecret: 'It asks for a password, PIN or one-time code (OTP).',
      urgency: 'It pushes you to hurry, or threatens you.',
      remoteAccess: 'It asks you to install an app that lets someone else control your phone or computer.',
      paymentAsk: 'It asks for money as a gift card, crypto or a fee.',
      insecure: 'The connection is not secure, and it asks for secrets.',
      crossForm: 'What you type here would be sent to a different website.',
    },
  },
  ne: {
    stop: 'रोकिनुहोस्। यो पेज ठगी हुन सक्छ। केही नलेख्नुहोस्।',
    careful: 'यो पेजमा होसियार रहनुहोस्।',
    why: 'किन?',
    family: 'परिवारलाई भन्नुहोस्',
    dismiss: 'बुझें',
    sent: 'तपाईंको परिवारलाई जानकारी गराइयो।',
    openPanel: 'साथी खोल्नुहोस् (हरियो आइकन) र त्यहाँ "परिवारलाई भन्नुहोस्" थिच्नुहोस्।',
    reasons: {
      lookalike: 'ठेगाना {brand} जस्तै देखिन्छ, तर फरक तरिकाले लेखिएको छ।',
      pretends: 'यो पेजले आफूलाई {brand} भन्छ, तर यसको ठेगाना {brand} को होइन।',
      asksSecret: 'यसले पासवर्ड, पिन वा एक पटकको कोड (OTP) माग्छ।',
      urgency: 'यसले तपाईंलाई हतार गर्न लगाउँछ, वा धम्की दिन्छ।',
      remoteAccess: 'यसले तपाईंको फोन वा कम्प्युटर अरूले चलाउन मिल्ने एप राख्न भन्छ।',
      paymentAsk: 'यसले गिफ्ट कार्ड, क्रिप्टो वा शुल्कको रूपमा पैसा माग्छ।',
      insecure: 'जडान सुरक्षित छैन, र यसले गोप्य कुरा माग्छ।',
      crossForm: 'तपाईंले यहाँ लेखेको कुरा अर्कै वेबसाइटमा पठाइन्छ।',
    },
  },
  hi: {
    stop: 'रुकिए। यह पेज ठगी हो सकता है। कुछ मत लिखिए।',
    careful: 'इस पेज पर सावधान रहिए।',
    why: 'क्यों?',
    family: 'परिवार को बताइए',
    dismiss: 'समझ गया',
    sent: 'आपके परिवार को बता दिया गया है।',
    openPanel: 'साथी खोलिए (हरा आइकन) और वहाँ "परिवार को बताइए" दबाइए।',
    reasons: {
      lookalike: 'पता {brand} जैसा दिखता है, लेकिन उसकी लिखावट अलग है।',
      pretends: 'यह पेज खुद को {brand} बताता है, लेकिन इसका पता {brand} का नहीं है।',
      asksSecret: 'यह पासवर्ड, पिन या वन-टाइम कोड (OTP) माँगता है।',
      urgency: 'यह जल्दी करने का दबाव डालता है, या धमकी देता है।',
      remoteAccess: 'यह ऐसा ऐप डालने को कहता है जिससे कोई और आपका फोन या कंप्यूटर चला सके।',
      paymentAsk: 'यह गिफ्ट कार्ड, क्रिप्टो या शुल्क के रूप में पैसे माँगता है।',
      insecure: 'कनेक्शन सुरक्षित नहीं है, और यह गोपनीय जानकारी माँगता है।',
      crossForm: 'आप यहाँ जो लिखेंगे वह किसी दूसरी वेबसाइट पर भेजा जाएगा।',
    },
  },
};

export const pickLang = (lang) => (TEXT[lang] ? lang : 'en');

/** One reason, in a language, with the brand put in. */
export function reasonText(reason, lang = 'en') {
  const t = TEXT[pickLang(lang)].reasons[reason.code] ?? TEXT.en.reasons[reason.code] ?? reason.code;
  return t.replaceAll('{brand}', reason.brand ?? '');
}

/** The whole warning: a headline, the reasons, and the labels for the buttons. */
export function warning(assessment, lang = 'en') {
  const t = TEXT[pickLang(lang)];
  return {
    level: assessment.level,
    headline: assessment.level === 'stop' ? t.stop : assessment.level === 'careful' ? t.careful : '',
    reasons: assessment.reasons.map((r) => reasonText(r, lang)),
    why: t.why,
    family: t.family,
    dismiss: t.dismiss,
    sent: t.sent,
    openPanel: t.openPanel,
  };
}

/** The same alert in plain English for the family, from the reason codes (no page content). */
export function alertSentence(alert) {
  const brand = alert.brand ? `a page pretending to be ${alert.brand}` : 'a page that looks like a scam';
  const why = (alert.reasons ?? [])
    .map((code) => TEXT.en.reasons[code])
    .filter(Boolean)
    .map((s) => s.replaceAll('{brand}', alert.brand ?? ''))
    .slice(0, 3)
    .join(' ');
  return `Someone in your group opened ${brand} (${alert.host}). ${why}`.trim();
}
