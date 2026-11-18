// Made-up messages in the style of real scams and real notices. Written for these tests; none is copied
// from a real person. Used to count how many scams are caught and how many ordinary messages are left alone.

export const SCAMS = [
  'Dear customer your Nabil Bank account will be blocked within 24 hours. Update your KYC now: http://nabilbank-kyc.top/login',
  'eSewa: your wallet is suspended. Verify your account immediately at http://esewa-verify.xyz or lose your balance',
  'You have won a lottery prize of Rs 50,00,000! Click bit.ly/xyz and share your bank card details to claim immediately',
  'Hi mum, this is my new number. I lost my phone. Please send money urgently, I will explain later',
  'Sir, I am calling from the bank. Please read out the OTP we sent to your phone so we can cancel the wrong payment',
  'Your parcel is held at customs. Pay the release fee today: tinyurl.com/p4rcel or it will be returned',
  'Your electricity will be disconnected tonight. Download the APK to pay the bill immediately: http://nea-bill.top/pay.apk',
  'Install AnyDesk and tell me the code so I can fix your account urgently',
  'State Bank of India: your account will be closed. Update your KYC within 24 hours at http://sbi-kyc-update.top',
  'तपाईंको खाता बन्द हुनेछ। तुरुन्त केवाईसी अपडेट गर्नुहोस् र ओटीपी पठाउनुहोस्: http://nabilbank-update.top',
  'आपका खाता बंद हो जाएगा। तुरंत केवाईसी अपडेट करें और अपना ओटीपी बताइए: http://sbi-kyc.top',
  'Congratulations! You have won a prize. To receive it, send a processing fee by gift card immediately. Reply with the card number.',
];

export const ORDINARY = [
  'Your OTP is 482913. Do not share it with anyone. - Nabil Bank',
  'तपाईंको ओटीपी 482913 हो। कसैलाई नदिनुहोस्।',
  'आपका ओटीपी 482913 है। किसी को न बताएं।',
  'Dear customer, your electricity bill of Rs 1,250 is due on 25th. Pay at nea.org.np',
  'Your Nabil Bank statement is ready: https://www.nabilbank.com/statements',
  'Are you coming for dinner on Saturday? Bring the photos.',
  'Happy birthday! Hope you have a lovely day. Call me when you are free.',
  'Reminder: your doctor appointment is tomorrow at 10 am at the clinic near the bus park.',
  'Your eSewa payment of Rs 500 to Ram Stores was successful. Balance Rs 2,340.',
  'I sent the money for the school fees yesterday, please check your account when you can.',
  'Your parcel was delivered today at 3 pm. Thank you for shopping with us.',
  'The meeting has moved to Thursday. Please confirm if you can come. Details: https://www.google.com/calendar',
];

// Ordinary messages chosen to stress the rules: they use the same words scams do (KYC, expire, update,
// reward points, "my new number") for ordinary reasons, or link to real addresses.
export const ORDINARY_TRICKY = [
  'Your NTC data pack will expire on 25 Nov. Recharge at https://www.ntc.net.np',
  'Dear customer, your KYC has been successfully updated. Thank you for banking with Nabil Bank.',
  'Please visit your nearest branch with a citizenship copy to update your KYC. - NIC Asia Bank',
  'Your Nabil Bank KYC is due. Visit https://www.nabilbank.com/kyc or any branch.',
  'Your SBI account statement for October is ready at https://www.onlinesbi.sbi',
  'Your reward points balance is 1,240. Redeem at https://www.hdfcbank.com/rewards',
  'Your electricity bill has been paid. Receipt: https://www.nea.org.np/r/12345',
  'Kindly update the app now to continue using Khalti: https://play.google.com/store/apps/details?id=com.khalti',
  'Mum, I changed my number, this is my new one. Save it. Love you.',
  'Sending you the family photos: https://photos.google.com/share/abc123',
  'तपाईंको केवाईसी सफलतापूर्वक अपडेट भयो। धन्यवाद।',
  'Your OTP for login is 123456. It will expire in 5 minutes. Do not share it.',
  'आपका खाता अपडेट हो गया है। धन्यवाद।',
  'Your parcel has been delivered. Track it at https://www.dhl.com/track',
  'Reminder: your KYC will expire on 31 March. Please visit the branch with your documents.',
  'Your fixed deposit has matured. Please visit the branch or call us to renew.',
];
