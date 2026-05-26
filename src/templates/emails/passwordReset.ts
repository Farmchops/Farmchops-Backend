import { simpleTemplate } from './base';

export const passwordResetTemplate = (code: string) => ({
  subject: 'Reset Your Farmchops Password',
  text: `Hello,\n\nPlease enter the code below to reset your password:\n\n${code}\n\nIf you didn't initiate this, please ignore this message.\n\nThank you for choosing Farmchops`,
  html: simpleTemplate(code, 'Please enter the code below to reset your password:')
});
