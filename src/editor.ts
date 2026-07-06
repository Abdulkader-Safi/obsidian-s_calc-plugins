import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { evaluate } from './engine';

const FENCE_OPEN = /^`{3,}\s*s-calc\s*$/i;
const FENCE_CLOSE = /^`{3,}\s*$/;

// Bumped when currency rates load so the editor re-evaluates blocks with currency.
let ratesVersion = 0;
export function bumpRatesVersion(): void {
	ratesVersion++;
}

class ResultWidget extends WidgetType {
	constructor(
		readonly text: string,
		readonly error: boolean,
	) {
		super();
	}

	eq(other: ResultWidget): boolean {
		return other.text === this.text && other.error === this.error;
	}

	toDOM(): HTMLElement {
		const span = activeDocument.createElement('span');
		span.className = 's-calc-result' + (this.error ? ' s-calc-error' : '');
		span.textContent = this.text;
		return span;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

interface BlockLine {
	from: number;
	to: number;
	text: string;
}

// ponytail: scans the whole document each rebuild. Fine for note-sized files;
// switch to viewport-only scanning if it ever lags on very large notes.
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const doc = view.state.doc;
	let block: BlockLine[] | null = null;

	const flush = (lines: BlockLine[]) => {
		const results = evaluate(lines.map((l) => l.text));
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!;
			const result = results[i];
			builder.add(line.from, line.from, Decoration.line({ class: 's-calc-line' }));
			if (result) {
				builder.add(
					line.to,
					line.to,
					Decoration.widget({
						widget: new ResultWidget(result.text, result.error),
						side: 1,
					}),
				);
			}
		}
	};

	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		const text = line.text;
		if (block === null) {
			if (FENCE_OPEN.test(text.trim())) block = [];
		} else if (FENCE_CLOSE.test(text.trim())) {
			flush(block);
			block = null;
		} else {
			block.push({ from: line.from, to: line.to, text });
		}
	}
	if (block !== null) flush(block);

	return builder.finish();
}

export const scalcEditorExtension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		private seenRatesVersion = ratesVersion;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate): void {
			if (
				update.docChanged ||
				update.viewportChanged ||
				this.seenRatesVersion !== ratesVersion
			) {
				this.seenRatesVersion = ratesVersion;
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
	},
);
