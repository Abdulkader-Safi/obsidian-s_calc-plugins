import assert from 'node:assert';
import { evaluate } from './engine';

function text(lines: string[]): (string | null)[] {
	return evaluate(lines).map((r) => (r ? r.text : null));
}

// Arithmetic
assert.strictEqual(text(['2 + 3 * 4'])[0], '14');

// Unit conversion (two-word unit phrase + "in" conversion)
assert.strictEqual(text(['20 ml in tea spoons'])[0], '4 tsp');

// Percentage (relative subtraction, and reverse percentage)
assert.strictEqual(text(['100 - 10%'])[0], '90');
assert.strictEqual(text(['20% of what is 30 cm'])[0], '150 cm');

// Variables carry down the block
assert.deepStrictEqual(text(['Price: 10', 'Price * 2']), ['10', '20']);

// sum and prev keywords
assert.strictEqual(text(['5', '10', 'sum'])[2], '15');
assert.strictEqual(text(['5', 'prev + 1'])[1], '6');

// Currency symbol works offline for USD
assert.strictEqual(text(['$10'])[0], '$10');

// Blank and comment lines produce no result
assert.deepStrictEqual(text(['', '# note', '3+3']), [null, null, '6']);

console.log('engine self-check passed');
