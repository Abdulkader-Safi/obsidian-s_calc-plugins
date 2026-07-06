import { evaluate } from './engine';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`self-check failed: ${message}`);
}

function text(lines: string[]): (string | null)[] {
	return evaluate(lines).map((r) => (r ? r.text : null));
}

function eq(lines: string[], expected: (string | null)[], message: string): void {
	assert(JSON.stringify(text(lines)) === JSON.stringify(expected), message);
}

// Arithmetic
assert(text(['2 + 3 * 4'])[0] === '14', 'arithmetic');

// Unit conversion (two-word unit phrase + "in" conversion)
assert(text(['20 ml in tea spoons'])[0] === '4 tsp', 'unit conversion');

// Percentage (relative subtraction, and reverse percentage)
assert(text(['100 - 10%'])[0] === '90', 'percentage');
assert(text(['20% of what is 30 cm'])[0] === '150 cm', 'reverse percentage');

// Variables carry down the block
eq(['Price: 10', 'Price * 2'], ['10', '20'], 'variables');

// sum and prev keywords
assert(text(['5', '10', 'sum'])[2] === '15', 'sum');
assert(text(['5', 'prev + 1'])[1] === '6', 'prev');

// Currency symbol works offline for USD
assert(text(['$10'])[0] === '$10', 'currency symbol');

// Blank and comment lines produce no result
eq(['', '# note', '3+3'], [null, null, '6'], 'blank/comment');
