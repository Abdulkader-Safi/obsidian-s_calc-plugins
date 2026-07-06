import { create, all } from 'mathjs';

// Single shared mathjs instance. currency.ts registers currency units on it once
// live rates are fetched; the engine evaluates against it.
export const math = create(all!, {});

// USD is the base currency unit. Other currencies are defined relative to it in
// currency.ts. Registering USD up front means dollar math works offline.
math.createUnit('USD', { aliases: ['usd', 'dollar', 'dollars'] });
