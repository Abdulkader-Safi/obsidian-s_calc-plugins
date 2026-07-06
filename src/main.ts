import { MarkdownView, Plugin } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { evaluate } from './engine';
import { scalcEditorExtension, bumpRatesVersion } from './editor';
import { loadRates } from './currency';

export default class SCalcPlugin extends Plugin {
	async onload() {
		// Live results while editing (source mode and live-preview raw blocks).
		this.registerEditorExtension(scalcEditorExtension);

		// Results in the rendered block (reading view, live-preview rendered block).
		this.registerMarkdownCodeBlockProcessor('s-calc', (source, el) => {
			renderBlock(source, el);
		});

		void loadRates(() => this.onRatesLoaded());
	}

	onunload() {}

	private onRatesLoaded(): void {
		bumpRatesVersion();
		// Nudge open editors and rendered views to recompute currency lines.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			const cm = (view.editor as unknown as { cm?: EditorView }).cm;
			cm?.dispatch({});
			view.previewMode?.rerender(true);
		});
	}
}

function renderBlock(source: string, el: HTMLElement): void {
	const lines = source.replace(/\n+$/, '').split('\n');
	const results = evaluate(lines);
	const container = el.createDiv({ cls: 's-calc-block' });

	lines.forEach((line, i) => {
		const row = container.createDiv({ cls: 's-calc-row' });
		row.createSpan({ cls: 's-calc-expr', text: line });
		const result = results[i];
		if (result) {
			row.createSpan({
				cls: 's-calc-value' + (result.error ? ' s-calc-error' : ''),
				text: result.text,
			});
		}
	});
}
