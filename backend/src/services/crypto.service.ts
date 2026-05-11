import crypto from 'crypto';

export const generateUrlSafeToken = () => {
  return crypto.randomBytes(32).toString('base64url');
};
