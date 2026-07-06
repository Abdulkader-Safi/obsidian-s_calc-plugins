import { create, all } from 'mathjs';

// Single shared mathjs instance. currency.ts registers currency units on it once
// live rates are fetched; the engine evaluates against it.
export const math = create(all!, {});

// Maps every currency unit name/alias (as it appears in the parsed result, e.g.
// "USD", "Euro", "pound") to its ISO code, so the engine can print a clean code
// regardless of which alias the user typed. Populated here for USD and by
// currency.ts for the rest.
export const currencyCode = new Map<string, string>();

export function registerCurrencyCode(code: string, names: string[]): void {
	currencyCode.set(code, code);
	for (const n of names) currencyCode.set(n, code);
}

// USD is the base currency unit. Other currencies are defined relative to it in
// currency.ts. Registering USD up front means dollar math works offline.
const USD_ALIASES = ['usd', 'dollar', 'dollars'];
math.createUnit('USD', { aliases: USD_ALIASES });
registerCurrencyCode('USD', USD_ALIASES);
