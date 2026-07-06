import { requestUrl } from 'obsidian';
import { math, registerCurrencyCode } from './mathjs-setup';

// Free, no-key endpoint. Returns USD-based rates for ~160 currencies.
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

// Human-name aliases so "4 GBP in Euro" or "5 Kuwait dinar" resolve. The code
// itself and its lowercase form are always registered too (when free).
const ALIASES: Record<string, string[]> = {
	EUR: ['euro', 'euros'],
	GBP: ['pound', 'pounds', 'sterling', 'quid'],
	JPY: ['yen'],
	AUD: ['aud'],
	CAD: ['cad'],
	CHF: ['franc', 'francs'],
	CNY: ['yuan', 'rmb'],
	INR: ['rupee', 'rupees'],
	KWD: ['dinar', 'dinars', 'kuwaiti_dinar', 'kd'],
	LBP: ['lira', 'lebanese_lira', 'lebanese_pound'],
	RUB: ['ruble', 'rubles'],
	BRL: ['real', 'reais'],
	KRW: ['won'],
	TRY: ['turkish_lira'],
	AED: ['dirham', 'dirhams'],
	SAR: ['riyal', 'riyals'],
	ZAR: ['rand'],
	MXN: ['peso', 'pesos'],
};

let ready = false;

export function haveRates(): boolean {
	return ready;
}

/** Fetch rates once and register every currency as a mathjs unit. */
export async function loadRates(onLoaded: () => void): Promise<void> {
	if (ready) return;
	try {
		const res = await requestUrl({ url: RATES_URL });
		const rates: Record<string, number> = res.json?.rates ?? {};
		let registered = 0;

		for (const [code, rate] of Object.entries(rates)) {
			if (!rate || code === 'USD') continue;
			// rate = units of `code` per 1 USD, so 1 code = (1/rate) USD.
			if (registerCurrency(code, 1 / rate)) registered++;
		}

		if (registered > 0) {
			ready = true;
			onLoaded();
		}
	} catch (e) {
		console.error('S-Calc: could not load currency rates', e);
	}
}

function registerCurrency(code: string, usdPerUnit: number): boolean {
	if (unitExists(code)) return false;

	// mathjs units are case-sensitive, so register lower and Capitalized variants
	// of each name (e.g. "euro" and "Euro") plus the lowercase code.
	const names = [code.toLowerCase(), ...(ALIASES[code] ?? [])];
	const variants = new Set<string>();
	for (const n of names) {
		variants.add(n);
		variants.add(n.charAt(0).toUpperCase() + n.slice(1));
	}
	const aliases = [...variants].filter((a) => a !== code && !unitExists(a));

	try {
		math.createUnit(code, { definition: `${usdPerUnit} USD`, aliases });
		registerCurrencyCode(code, aliases);
		return true;
	} catch {
		// An alias clashed; register the bare code so at least the ISO code works.
		try {
			math.createUnit(code, { definition: `${usdPerUnit} USD` });
			registerCurrencyCode(code, []);
			return true;
		} catch {
			return false;
		}
	}
}

function unitExists(name: string): boolean {
	try {
		math.unit(name);
		return true;
	} catch {
		return false;
	}
}
