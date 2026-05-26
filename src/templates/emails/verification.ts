import { simpleTemplate } from './base';

export const verificationTemplate = (code: string) => ({
  subject: 'Verify Your Farmchops Account',
  text: `Hello,\n\nPlease enter the code below to complete your login:\n\n${code}\n\nIf you didn't initiate this, please ignore this message.\n\nThank you for choosing Farmchops`,
  html: simpleTemplate(code, 'Please enter the code below to complete your login:')
});
