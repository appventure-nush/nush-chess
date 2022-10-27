import {verify, VerifyOptions} from 'jsonwebtoken';
import jwksClient = require('jwks-rsa');
// Weird ESlint import ordering bug
// eslint-disable-next-line


export default async function verifyToken(token: string) {
  // Node has no atob
  const atob = (base64: string) => Buffer.from(base64, 'base64').toString('ascii');
  const {kid} = JSON.parse(atob(token.split('.')[0]));
  const client = jwksClient({
    cache: true,
    jwksUri: 'https://login.microsoftonline.com/common/discovery/keys',
  });
  return new Promise(((resolve, reject) => {
    client.getSigningKey(kid, async (err, key) => {
      if(!key){
        return reject("Signing key does not exist!");
      }
      if (err) return reject(err);
      try {
        const signingKey = key.getPublicKey();
        const options: VerifyOptions = {
          algorithms: ['RS256'],
          ignoreExpiration: true,
          maxAge: '1 year',
          audience: "c8115b04-01cf-451e-a9bb-95170936d45e",
        };
        const result: any = verify(token, signingKey, options);
        if (result.iss !== 'https://sts.windows.net/d72a7172-d5f8-4889-9a85-d7424751592a/') {
          return reject(new Error('Token issuer invalid'));
        }
        return resolve(result);
      } catch (e) {
        return reject(e);
      }
    });
  }));
}