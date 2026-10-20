import { tokenQueExpiraEn } from '../../../testing/jwt';
import { expiracionJwt } from './jwt';

describe('expiracionJwt', () => {
  it('lee el claim exp en milisegundos', () => {
    const exp = expiracionJwt(tokenQueExpiraEn(60_000));
    expect(exp).not.toBeNull();
    expect(Math.abs(exp! - (Date.now() + 60_000))).toBeLessThan(1500);
  });

  it('devuelve null si el token no es un JWT legible', () => {
    expect(expiracionJwt('no-es-un-jwt')).toBeNull();
    expect(expiracionJwt('a.%%%.c')).toBeNull();
    expect(expiracionJwt(`${btoa('{}')}.${btoa('{"sub":"x"}')}.f`)).toBeNull();
  });
});
