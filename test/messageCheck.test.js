import { describe, it, expect } from 'vitest';
import { assessMessage, linksIn } from '../src/messageCheck.js';
import { messageWarning, alertSentence } from '../src/guardText.js';

const level = (m) => assessMessage(m).level;
const codes = (m) => assessMessage(m).reasons.map((r) => r.code);

describe('linksIn', () => {
  it('finds addresses with or without http, and ignores the part after @', () => {
    expect(linksIn('Go to http://nabilbank-kyc.top/login now or bit.ly/abc. Mail me at ram@gmail.com')).toEqual(['nabilbank-kyc.top', 'bit.ly']);
  });
  it('does not mistake ordinary words with dots for addresses', () => {
    expect(linksIn('Mr.Sharma said e.g. tomorrow. Dr.Rai too.')).toEqual([]);
  });
});

describe('scam messages', () => {
  it('stops a fake bank KYC message with a lookalike link and a rush', () => {
    const m = 'Dear customer your Nabil Bank account will be blocked within 24 hours. Update your KYC now: http://nabilbank-kyc.top/login';
    const a = assessMessage(m);
    expect(a.level).toBe('stop');
    expect(a.brand).toBe('Nabil Bank');
    expect(a.host).toBe('nabilbank-kyc.top');
    expect(a.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['lookalikeLink', 'pretendsMsg', 'urgency']));
  });
  it('stops a lottery message that hides its link and asks for card details', () => {
    expect(level('You have won a lottery prize of Rs 50,00,000! Click bit.ly/xyz and share your bank card details to claim immediately')).toBe('stop');
  });
  it('is careful about "this is my new number, send money"', () => {
    const m = 'Hi mum, this is my new number. I lost my phone. Please send money urgently';
    expect(level(m)).toBe('careful');
    expect(codes(m)).toContain('impersonation');
  });
  it('catches a request to read out a one-time code, in English, Nepali and Hindi', () => {
    expect(codes('Please read out the OTP we sent to your phone so we can fix your account')).toContain('shareSecret');
    expect(codes('तपाईंको ओटीपी हामीलाई पठाउनुहोस्')).toContain('shareSecret');
    expect(codes('अपना ओटीपी हमें बताइए')).toContain('shareSecret');
  });
  it('catches an app to install', () => {
    expect(codes('Your parcel is held. Download the APK to track it immediately')).toContain('remoteAccess');
  });
});

describe('ordinary messages', () => {
  it('gives no warning to a real bank OTP text that says not to share it', () => {
    expect(level('Your OTP is 482913. Do not share it with anyone. - Nabil Bank')).toBe('ok');
    expect(level('तपाईंको ओटीपी 482913 हो। कसैलाई नदिनुहोस्।')).toBe('ok');
    expect(level('आपका ओटीपी 482913 है। किसी को न बताएं।')).toBe('ok');
  });
  it('gives no warning to a bill reminder with the real address', () => {
    expect(level('Dear customer, your electricity bill of Rs 1,250 is due on 25th. Pay at nea.org.np')).toBe('ok');
  });
  it('gives no warning to everyday chat', () => {
    expect(level('Are you coming for dinner on Saturday? Bring the photos.')).toBe('ok');
    expect(level('')).toBe('ok');
  });
  it('does not call a real bank link an imitation', () => {
    expect(codes('Your Nabil Bank statement is ready: https://www.nabilbank.com/statements')).toEqual([]);
  });
});

describe('messageWarning and the alert sentence', () => {
  it('has a headline and reasons in all three languages', () => {
    const a = assessMessage('You have won a lottery prize! Click bit.ly/xyz and share your bank card details immediately');
    for (const lang of ['en', 'ne', 'hi']) {
      const w = messageWarning(a, lang);
      expect(w.headline.length).toBeGreaterThan(10);
      expect(w.reasons.length).toBeGreaterThan(0);
      expect(w.reasons.every((r) => !/^[a-zA-Z]+$/.test(r))).toBe(true); // no bare reason code left over
    }
    expect(messageWarning({ level: 'ok', reasons: [] }, 'ne').headline).toMatch(/[ऀ-ॿ]/);
  });
  it('describes a message alert for the family without any message text', () => {
    const s = alertSentence({ kind: 'message', host: 'nabilbank-kyc.top', brand: 'Nabil Bank', reasons: ['lookalike'] });
    expect(s).toContain('received a message pretending to be Nabil Bank (link to nabilbank-kyc.top)');
    expect(alertSentence({ kind: 'message', host: 'message', brand: '', reasons: ['impersonation'] })).toContain('received a message that looks like a scam.');
  });
});

import { SCAMS, ORDINARY } from './message.fixtures.js';

describe('fixture messages', () => {
  it('warns on every made-up scam message (careful or stop)', () => {
    const missed = SCAMS.filter((m) => level(m) === 'ok');
    expect(missed).toEqual([]);
  });
  it('stops on the ones with several signals, and cautions on the rest', () => {
    const stopped = SCAMS.filter((m) => level(m) === 'stop').length;
    console.log(`messages: ${stopped}/${SCAMS.length} stopped, ${SCAMS.filter((m) => level(m) === 'careful').length} careful`);
    expect(stopped).toBeGreaterThanOrEqual(5);
  });
  it('leaves every ordinary message alone', () => {
    const flagged = ORDINARY.filter((m) => level(m) !== 'ok').map((m) => `${level(m)}: ${m}`);
    expect(flagged).toEqual([]);
  });
});

import { PUBLISHED_SCAMS } from './message.published.js';
import { ORDINARY_TRICKY } from './message.fixtures.js';

describe('messages written to follow published reports', () => {
  it('warns on every one', () => {
    const missed = PUBLISHED_SCAMS.filter((s) => level(s.text) === 'ok').map((s) => s.from);
    expect(missed).toEqual([]);
  });
  it('stops on every one (several signals agree)', () => {
    const notStopped = PUBLISHED_SCAMS.filter((s) => level(s.text) !== 'stop').map((s) => `${level(s.text)}: ${s.from}`);
    expect(notStopped).toEqual([]);
  });
});

describe('ordinary messages that use scam words for ordinary reasons', () => {
  it('leaves every one alone', () => {
    const flagged = ORDINARY_TRICKY.filter((m) => level(m) !== 'ok').map((m) => `${level(m)} ${assessMessage(m).reasons.map((r) => r.code)}: ${m}`);
    expect(flagged).toEqual([]);
  });
});

describe('speed', () => {
  it('handles a 4000-character message of repeated trouble spots quickly', () => {
    const nasty = ('share ' + 'a'.repeat(25) + ' ').repeat(300);
    const t = Date.now();
    assessMessage(nasty);
    assessMessage('http://' + 'a-'.repeat(1500));
    assessMessage('.'.repeat(4000));
    expect(Date.now() - t).toBeLessThan(500);
  });
});

// Cases from an independent review of the checker. Each one was a real failure before the fix.
describe('review findings', () => {
  const stopOrCare = (m) => expect(level(m)).not.toBe('ok');
  it('reads the real destination of "http://bank.com@evil.top"', () => {
    expect(linksIn('Update at http://nabilbank.com@evil.top/login')).toEqual(['evil.top']);
    stopOrCare('Your Nabil Bank account will be blocked immediately. Update at http://nabilbank.com@evil.top/login');
    expect(linksIn('Mail me at ram@gmail.com')).toEqual([]);
  });
  it('sees links on unusual endings, number addresses and non-English letters when http is present', () => {
    expect(linksIn('Update at http://nabilbank-kyc.cfd/login')).toEqual(['nabilbank-kyc.cfd']);
    stopOrCare('Update at http://nabilbank-kyc.cfd/login');
    expect(codes('Verify your account at http://192.0.2.7/kyc')).toContain('oddLink');
    expect(codes('Verify your account at https://नाबिल.com/kyc')).toContain('oddLink');
  });
  it('does not let "do not delay" or "do not worry" cancel a request for a code', () => {
    expect(codes('Do not delay: share your OTP now')).toContain('shareSecret');
    expect(codes('Do not worry, just share your OTP with me')).toContain('shareSecret');
    expect(codes('Kindly SHARE your O.T.P')).toContain('shareSecret');
    expect(codes('अपना ओटीपी भेज दो')).toContain('shareSecret');
    expect(codes('अपना ओटीपी भेज दीजिए')).toContain('shareSecret');
  });
  it('still lets a real warning cancel it', () => {
    expect(level('Do not share your OTP with anyone. Nabil Bank staff never ask for it.')).toBe('ok');
    expect(level('Never share your PIN or OTP.')).toBe('ok');
  });
  it('does not warn about a bank text that says to enter the code on the website', () => {
    expect(level('Your OTP is 481516. Enter OTP 481516 on the website to complete your payment. - Nabil Bank')).toBe('ok');
    expect(level('Nabil Bank: do not share your OTP. Enter OTP 5544 to proceed')).toBe('ok');
    expect(level('To login enter your PIN at the ATM')).toBe('ok');
    expect(level('Please confirm the password reset request')).toBe('ok');
  });
  it('is careful about weak signals instead of hiding them', () => {
    stopOrCare('Your parcel is held. Pay processing fee at http://post-nepal.xyz/track');
    stopOrCare('Dear SBI customer your account will be blocked. update PAN: http://bit.ly/3xyz');
    stopOrCare('Your account is suspended. Verify at http://sbi-secure-login.com');
    stopOrCare('Congratulations you have won a prize! Call now');
  });
  it('does not mistake a missing space after a full stop for a link', () => {
    expect(linksIn('Thanks.Me too. Call me.In the morning')).toEqual([]);
    expect(linksIn('see you.live')).toEqual([]);
    expect(level('Went to Nabil Bank today.Me too, urgent please call immediately')).not.toBe('stop');
    expect(linksIn('Read it at wiki.example.com/page or www.mysite.me')).toEqual(['wiki.example.com', 'mysite.me']);
  });
  it('does not call a family message with an ordinary link a scam because it names a bank', () => {
    expect(level('Went to Nabil Bank today. Photos: https://photos.google.com/abc. Urgent! call me immediately')).toBe('ok');
    expect(level('Nabil Bank: pay your NEA bill at nea.org.np. Due immediately urgent')).toBe('ok');
  });
  it('does not treat a new number or a friend asking for yours as a money scam', () => {
    expect(level('Here is my new number, send me yours')).toBe('ok');
    expect(level('my new number is 9800000000, send me a message when you see this')).toBe('ok');
    expect(codes('Hi mum, new phone, who is this? Can you transfer some money for me')).toContain('impersonation');
  });
  it('reports when a long message was cut', () => {
    expect(assessMessage('a'.repeat(4001)).truncated).toBe(true);
    expect(assessMessage('short').truncated).toBe(false);
  });
});

describe('home passwords', () => {
  it('does not warn when a friend asks for the wifi or a streaming password', () => {
    for (const t of ['Can you send me the wifi password? I am at your house.', 'Please share the Netflix password with me, thanks', 'give me the router password']) {
      expect(assessMessage(t).level, t).toBe('ok');
    }
  });
  it('still warns when a bank word is anywhere in the message', () => {
    expect(assessMessage('Your bank account is blocked. Send the wifi password and OTP now').level).not.toBe('ok');
    expect(assessMessage('Send your bank account password').level).not.toBe('ok');
  });
});
it('a wifi ask that also wants an OTP is still a warning', () => {
  expect(assessMessage('send the wifi password and the OTP').level).not.toBe('ok');
});
