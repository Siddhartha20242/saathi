// A plain record of where each AI call ran in this session. Kept apart from firebase.js so the page can show it
// without loading the Firebase code. Never holds a prompt or an answer.
export const usage = [];
export const getUsage = () => usage.slice();
