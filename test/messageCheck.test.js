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
