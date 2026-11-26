/**
 * SMS for login codes. The provider (e.g. MSG91, with DLT-registered templates) is plugged in
 * in the integrations phase and runs through the queue. Until then: development and test runs
 * print the code to the server log; production refuses (phone login stays off there).
 */
export async function sendLoginCode(phoneNumber: string, code: string) {
  if (process.env.NODE_ENV !== 'production' || process.env.IWD_E2E === '1') {
    console.info(`[sms:dev] login code for ${phoneNumber.replace(/\d(?=\d{4})/g, '•')}: ${code}`);
    return;
  }
  throw new Error('SMS is not configured yet');
}

/** Indian mobiles and other E.164 numbers: +<country><number>. */
export const isE164 = (v: string) => /^\+[1-9]\d{7,14}$/.test(v);
