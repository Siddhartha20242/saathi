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
      lookalikeLink: 'The link looks like {brand}, but its address is spelled differently.',
      pretendsMsg: 'This message says it is from {brand}, but the link goes somewhere else.',
      shortLink: 'The link is shortened, so you cannot see where it really goes.',
      shareSecret: 'It asks you to share or send a code, PIN or password. A real bank never asks for these.',
      impersonation: 'It says "this is my new number" and asks for money. Call the person on the number you already have.',
    },
    msg: {
      stop: 'Stop. This message may be a scam. Do not click, reply, or share any code.',
      careful: 'Be careful with this message. Check with your family before you do anything.',
      ok: 'Nothing suspicious was found, but this does not prove it is safe. If it asks for money, a code or a PIN, ask your family first.',
      empty: 'Paste a message first.',
      sent: 'Your family has been told.',
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
      lookalikeLink: 'लिङ्क {brand} जस्तै देखिन्छ, तर ठेगाना फरक तरिकाले लेखिएको छ।',
      pretendsMsg: 'यो सन्देशले आफूलाई {brand} को भन्छ, तर लिङ्क अर्कै ठाउँमा जान्छ।',
      shortLink: 'लिङ्क छोटो पारिएको छ, त्यसैले यो साँच्चै कहाँ जान्छ भन्ने देखिँदैन।',
      shareSecret: 'यसले कोड, पिन वा पासवर्ड पठाउन वा भन्न लगाउँछ। साँचो बैंकले कहिल्यै यी माग्दैन।',
      impersonation: 'यसले "यो मेरो नयाँ नम्बर हो" भनेर पैसा माग्छ। तपाईंसँग भएको नम्बरमा नै फोन गर्नुहोस्।',
    },
    msg: {
      stop: 'रोकिनुहोस्। यो सन्देश ठगी हुन सक्छ। लिङ्क नथिच्नुहोस्, जवाफ नदिनुहोस्, कुनै कोड नभन्नुहोस्।',
      careful: 'यो सन्देशमा होसियार रहनुहोस्। केही गर्नुअघि परिवारसँग सोध्नुहोस्।',
      ok: 'शंकास्पद केही भेटिएन, तर यसको अर्थ यो सुरक्षित हो भन्ने होइन। पैसा, कोड वा पिन मागेको छ भने पहिले परिवारलाई सोध्नुहोस्।',
      empty: 'पहिले सन्देश टाँस्नुहोस्।',
      sent: 'तपाईंको परिवारलाई जानकारी गराइयो।',
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
      lookalikeLink: 'लिंक {brand} जैसा दिखता है, लेकिन उसका पता अलग लिखा है।',
      pretendsMsg: 'यह संदेश खुद को {brand} का बताता है, लेकिन लिंक कहीं और जाता है।',
      shortLink: 'लिंक छोटा किया गया है, इसलिए पता नहीं चलता कि यह असल में कहाँ जाता है।',
      shareSecret: 'यह कोड, पिन या पासवर्ड बताने या भेजने को कहता है। असली बैंक कभी ये नहीं माँगता।',
      impersonation: 'यह "यह मेरा नया नंबर है" कहकर पैसे माँगता है। आपके पास जो नंबर पहले से है, उसी पर फोन कीजिए।',
    },
    msg: {
      stop: 'रुकिए। यह संदेश ठगी हो सकता है। लिंक मत दबाइए, जवाब मत दीजिए, कोई कोड मत बताइए।',
      careful: 'इस संदेश पर सावधान रहिए। कुछ करने से पहले परिवार से पूछिए।',
      ok: 'कुछ संदिग्ध नहीं मिला, लेकिन इसका मतलब यह नहीं कि यह सुरक्षित है। अगर यह पैसे, कोड या पिन माँगे तो पहले परिवार से पूछिए।',
      empty: 'पहले संदेश चिपकाइए।',
      sent: 'आपके परिवार को बता दिया गया है।',
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

/** The warning for a pasted message: a headline for the level, the reasons, and the family button's words. */
export function messageWarning(assessment, lang = 'en') {
  const t = TEXT[pickLang(lang)];
  return {
    level: assessment.level,
    headline: t.msg[assessment.level] ?? '',
    reasons: assessment.reasons.map((r) => reasonText(r, lang)),
    family: t.family,
    sent: t.msg.sent,
    empty: t.msg.empty,
  };
}

/** The same alert in plain English for the family, from the reason codes (no page or message content). */
export function alertSentence(alert) {
  const why = (alert.reasons ?? [])
    .map((code) => TEXT.en.reasons[code])
    .filter(Boolean)
    .map((s) => s.replaceAll('{brand}', alert.brand ?? ''))
    .slice(0, 3)
    .join(' ');
  if (alert.kind === 'message') {
    const brand = alert.brand ? `a message pretending to be ${alert.brand}` : 'a message that looks like a scam';
    const link = alert.host && alert.host !== 'message' ? ` (link to ${alert.host})` : '';
    return `Someone in your group received ${brand}${link}. ${why}`.trim();
  }
  const brand = alert.brand ? `a page pretending to be ${alert.brand}` : 'a page that looks like a scam';
  return `Someone in your group opened ${brand} (${alert.host}). ${why}`.trim();
}
