import { describe, expect, it } from 'vitest';
import { matchesPrintCode, parsePrintCode } from './print-code';

describe('parsePrintCode', () => {
  it('reconnaît un code imprimé, quelle que soit la langue', () => {
    expect(parsePrintCode('SDBE-FR001')).toEqual({ set: 'SDBE', number: '001' });
    expect(parsePrintCode('lob-en001')).toEqual({ set: 'LOB', number: '001' });
    expect(parsePrintCode('LOB-001')).toEqual({ set: 'LOB', number: '001' });
  });

  it('ignore le reste', () => {
    expect(parsePrintCode('dragon blanc')).toBeNull();
    expect(parsePrintCode('SDBE')).toBeNull();
  });
});

describe('matchesPrintCode', () => {
  it('compare sans tenir compte de la langue', () => {
    expect(matchesPrintCode('SDBE-EN001', { set: 'SDBE', number: '001' })).toBe(true);
    expect(matchesPrintCode('SDBE-EN002', { set: 'SDBE', number: '001' })).toBe(false);
  });
});
