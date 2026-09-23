/**
 * Suite registration validation (fidelizacion slice 2): the client-side RUT
 * modulo-11 and email format-only validators mirror the server rule in
 * backend/app.py (server authoritative). Vectors here must stay in sync
 * with the Python side: valid RUTs pass mod-11, invalid RUTs fail it, and
 * emails are judged by format/regex only (no MX or deliverability checks).
 */
import { isValidEmail, isValidRut, normalizeRut } from '../../scripts/login.js';

describe('normalizeRut', () => {
  test('strips dots and spaces and uppercases K', () => {
    expect(normalizeRut('12.345.678-5')).toBe('12345678-5');
    expect(normalizeRut('12 345 670-k')).toBe('12345670-K');
  });
});

describe('isValidRut (modulo-11, new registrations)', () => {
  test.each(['12345678-5', '11111111-1', '12.345.678-5', '12345670-K', '12345670-k'])(
    'accepts valid RUT %s',
    (rut) => {
      expect(isValidRut(rut)).toBe(true);
    },
  );

  test.each([
    '12345678-9', // wrong check digit
    '11111111-2', // wrong check digit
    '123456785', // missing hyphen
    'abcdefg-h', // non-numeric body
    '', // empty
  ])('rejects invalid RUT %s', (rut) => {
    expect(isValidRut(rut)).toBe(false);
  });
});

describe('isValidEmail (format-only, no MX/loop)', () => {
  test.each(['ana@example.com', 'nombre.apellido+tag@sub.dominio.cl', 'raro@ejemplo-invalido.xyz'])(
    'accepts valid-format email %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  test.each([
    'anaexample.com', // missing @
    'ana@', // missing domain
    'ana@correo', // missing dot in domain
    'ana @example.com', // inner space
    '', // empty
  ])('rejects malformed email %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
