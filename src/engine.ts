import * as chrono from 'chrono-node';
import { math, currencyCode } from './mathjs-setup';

export type LineResult = { text: string; error: boolean } | null;

// Currencies we know a symbol for. Anything registered as a unit still works;
// this map only controls how the result is printed.
const CURRENCY_SYMBOLS: Record<string, string> = {
	USD: '$',
	EUR: '€',
	GBP: '£',
	JPY: '¥',
	AUD: 'A$',
	CAD: 'C$',
	CHF: 'CHF ',
	CNY: '¥',
	INR: '₹',
};

// Symbol -> currency code, used to rewrite "$10" into "10 USD" before evaluation.
const SYMBOL_TO_CODE: Record<string, string> = {
	$: 'USD',
	'€': 'EUR',
	'£': 'GBP',
	'¥': 'JPY',
	'₹': 'INR',
};

// A few long unit names shortened for display. ponytail: tiny map, extend if needed.
const UNIT_ABBREV: Record<string, string> = {
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
};

// Two-word units collapsed to their mathjs single-word name before evaluation.
const UNIT_PHRASES: [RegExp, string][] = [
	[/\btea\s*spoons?\b/gi, 'teaspoon'],
	[/\btable\s*spoons?\b/gi, 'tablespoon'],
];

const DATE_ARITH = /^(.*?)\s*([+-])\s*(\d+)\s*(day|week|month|year)s?\s*$/i;

/** Evaluate a block of lines in order, sharing a scope so labels and sum/prev carry down. */
export function evaluate(lines: string[]): LineResult[] {
	const scope: Record<string, unknown> = {};
	const results: LineResult[] = [];
	let prev: unknown = undefined;
	let runningSum: unknown = null;

	for (const raw of lines) {
		const line = raw.trim();

		if (line === '' || line.startsWith('#') || line.startsWith('//')) {
			results.push(null);
			continue;
		}

		scope.prev = prev;
		scope.sum = runningSum;
		scope.total = runningSum;

		const { result, value } = evaluateLine(line, scope);
		results.push(result);

		if (value !== undefined && value !== null && !(result && result.error)) {
			prev = value;
			runningSum = addSafe(runningSum, value);
		}
	}

	return results;
}

function evaluateLine(
	line: string,
	scope: Record<string, unknown>,
): { result: LineResult; value: unknown } {
	// Assignment: "label: expr" or "label = expr".
	const assign = /^([A-Za-z][A-Za-z0-9 _]*?)\s*[:=]\s*(.+)$/.exec(line);
	const expr = assign ? assign[2]! : line;
	const label = assign ? assign[1]!.trim() : null;

	const value = tryCompute(expr, scope);

	if (value === undefined) {
		// Not a calculation we understand. Only flag an error if it looks like math.
		const error = /\d/.test(expr);
		return { result: error ? { text: '?', error: true } : null, value: null };
	}

	if (label) {
		const key = label.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
		if (key) scope[key] = value;
	}

	return { result: { text: formatValue(value), error: false }, value };
}

/** Try mathjs, then a natural-language date, else undefined. */
function tryCompute(expr: string, scope: Record<string, unknown>): unknown {
	const mathExpr = preprocess(expr);
	try {
		const v: unknown = math.evaluate(mathExpr, scope);
		if (typeof v === 'function') return undefined;
		return v;
	} catch {
		return tryDate(expr);
	}
}

function preprocess(expr: string): string {
	let s = expr;

	// Currency symbols before a number: "$10" -> "10 USD".
	s = s.replace(/([$€£¥₹])\s*([\d.,]+)/g, (_m, sym: string, num: string) => {
		return `${num} ${SYMBOL_TO_CODE[sym]}`;
	});

	// "20% of what is 30" -> reverse percentage; "20% of 30" -> forward.
	s = s.replace(
		/([\d.]+)\s*%\s*of\s+what\s+is\s+(.+)/i,
		(_m, pct: string, rest: string) => `(${rest}) / (${pct}/100)`,
	);
	s = s.replace(
		/([\d.]+)\s*%\s*of\s+(.+)/i,
		(_m, pct: string, rest: string) => `(${rest}) * (${pct}/100)`,
	);

	// Collapse two-word units.
	for (const [re, name] of UNIT_PHRASES) s = s.replace(re, name);

	// Rewrite "LEFT in UNIT REST" into "(LEFT to UNIT) REST". Using mathjs's "to"
	// avoids the "in" == inch alias, and the parens keep the conversion binding
	// tighter than a trailing operator (e.g. "sum in USD - 4%").
	// ponytail: single-word conversion target only; write "inch" for inches and
	// use an ISO code for multi-word currency names.
	s = s.replace(
		/^(.*?)\s+in\s+([A-Za-z_][A-Za-z0-9_]*)\b(.*)$/i,
		'($1 to $2)$3',
	);

	return s;
}

function tryDate(expr: string): unknown {
	const arith = DATE_ARITH.exec(expr);
	if (arith) {
		const base = chrono.parseDate(arith[1]!);
		if (base) {
			return shiftDate(
				base,
				arith[2] === '-' ? -Number(arith[3]) : Number(arith[3]),
				arith[4]!.toLowerCase(),
			);
		}
	}
	const d = chrono.parseDate(expr);
	return d ?? undefined;
}

function shiftDate(date: Date, n: number, unit: string): Date {
	const d = new Date(date.getTime());
	if (unit === 'day') d.setDate(d.getDate() + n);
	else if (unit === 'week') d.setDate(d.getDate() + n * 7);
	else if (unit === 'month') d.setMonth(d.getMonth() + n);
	else if (unit === 'year') d.setFullYear(d.getFullYear() + n);
	return d;
}

/** Fold values into a running sum, skipping any that can't be added together. */
function addSafe(acc: unknown, value: unknown): unknown {
	if (typeof value !== 'number' && !isUnit(value)) return acc;
	if (acc === null) return value;
	try {
		return math.add(acc as never, value as never);
	} catch {
		return acc;
	}
}

interface MathUnit {
	formatUnits(): string;
	toNumeric(u: string): number;
	units: { unit: { name: string } }[];
}

function isUnit(v: unknown): v is MathUnit {
	return typeof v === 'object' && v !== null && 'toNumeric' in v && 'formatUnits' in v;
}

function formatValue(value: unknown): string {
	if (value instanceof Date) return value.toLocaleDateString();
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'number') return formatNumber(value);

	if (isUnit(value)) {
		const unitStr = value.formatUnits();
		const n = value.toNumeric(unitStr);
		// Resolve the ISO code from whatever alias was used (e.g. "Euro" -> EUR).
		const name = value.units[0]?.unit.name ?? unitStr;
		const code = currencyCode.get(name) ?? currencyCode.get(unitStr);

		if (code) {
			const sym = CURRENCY_SYMBOLS[code];
			return sym ? `${sym}${formatNumber(n)}` : `${formatNumber(n)} ${code}`;
		}
		const label = UNIT_ABBREV[unitStr] ?? unitStr;
		return `${formatNumber(n)} ${label}`;
	}

	// BigNumber / Fraction and anything else: let mathjs stringify it.
	try {
		return math.format(value, { precision: 6 });
	} catch {
		return String(value);
	}
}

function formatNumber(n: number): string {
	if (!isFinite(n)) return String(n);
	const rounded = parseFloat(n.toFixed(4));
	return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 });
}
