import { Plugin, TFile } from "obsidian";

interface NoteOrderData {
	[folderPath: string]: string[];
}

export default class NoteOrderPlugin extends Plugin {
	private data: NoteOrderData = {};
	private observer: MutationObserver | null = null;
	private dragging: HTMLElement | null = null;
	private placeholder: HTMLElement | null = null;
	private offsetY = 0;
	private currentContainer: HTMLElement | null = null;
	private currentFolderPath: string = "";
	private isDragging = false;

	async onload() {
		await this.loadData_();

		this.app.workspace.onLayoutReady(() => {
			setTimeout(() => {
				this.injectFileExplorer();
				this.startObserver();
			}, 500);
		});

		// Global mouse events — attached once at plugin level
		this.registerDomEvent(document, "mousemove", (e: MouseEvent) => this.onMouseMove(e));
		this.registerDomEvent(document, "mouseup", (e: MouseEvent) => this.onMouseUp(e));
		this.registerDomEvent(window, "mousemove", (e: MouseEvent) => this.onMouseMove(e));
		this.registerDomEvent(window, "mouseup", (e: MouseEvent) => this.onMouseUp(e));
	}

	// ─── Inject into file explorer ────────────────────────────────────────────

	private injectFileExplorer() {
		const fileExplorer = this.getFileExplorerContainer();
		if (!fileExplorer) return;

		fileExplorer.querySelectorAll<HTMLElement>(".nav-folder").forEach((folderEl) => {
			const folderPath = this.getFolderPathFromEl(folderEl);
			if (!folderPath) return;

			const childrenContainer = folderEl.querySelector<HTMLElement>(".nav-folder-children");
			if (!childrenContainer) return;

			this.applySavedOrder(childrenContainer, folderPath);

			childrenContainer.querySelectorAll<HTMLElement>(":scope > .nav-file").forEach((fileEl) => {
				this.attachDrag(fileEl, childrenContainer, folderPath);
			});
		});
	}

	private attachDrag(fileEl: HTMLElement, container: HTMLElement, folderPath: string) {
		if (fileEl.dataset.noteOrderDrag === "1") return;
		fileEl.dataset.noteOrderDrag = "1";
		fileEl.style.cursor = "grab";

		this.registerDomEvent(fileEl, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Shift") fileEl.style.cursor = "grab";
		});

		this.registerDomEvent(fileEl, "keyup", (e: KeyboardEvent) => {
			if (e.key === "Shift") fileEl.style.cursor = "default";
		});

		this.registerDomEvent(fileEl, "mousedown", (e: MouseEvent) => {
			if (e.button !== 0) return;

			const startX = e.clientX;
			const startY = e.clientY;

			const onMoveCheck = (moveEvent: MouseEvent) => {
				const dx = Math.abs(moveEvent.clientX - startX);
				const dy = Math.abs(moveEvent.clientY - startY);

				if ((dx > 5 || dy > 5) && e.shiftKey ) {
					document.removeEventListener("mousemove", onMoveCheck);
					document.removeEventListener("mouseup", onClickCancel);

					e.preventDefault();
					e.stopPropagation();

					this.dragging = fileEl;
					this.currentContainer = container;
					this.currentFolderPath = folderPath;
					this.offsetY = e.clientY - fileEl.getBoundingClientRect().top;
					this.isDragging = true;
					this.observer?.disconnect();

					this.placeholder = document.createElement("div");
					this.placeholder.style.cssText = `
						height: ${fileEl.offsetHeight}px;
						border-radius: 4px;
						border: 2px dashed var(--interactive-accent);
						background: var(--background-secondary-alt);
						margin: 1px 0;
						box-sizing: border-box;
					`;

					const rect = fileEl.getBoundingClientRect();
					fileEl.style.cssText += `
						position: fixed;
						z-index: 9999;
						width: ${container.offsetWidth}px;
						opacity: 0.85;
						pointer-events: none;
						top: ${rect.top}px;
						left: ${rect.left}px;
						background: var(--background-secondary);
						border-radius: 4px;
						box-shadow: 0 4px 12px rgba(0,0,0,0.25);
					`;

					container.insertBefore(this.placeholder, fileEl);
				}
			};

			const onClickCancel = () => {
				document.removeEventListener("mousemove", onMoveCheck);
				document.removeEventListener("mouseup", onClickCancel);
			};

			document.addEventListener("mousemove", onMoveCheck);
			document.addEventListener("mouseup", onClickCancel);
		});
	}

	// ─── Global mouse move ────────────────────────────────────────────────────

	private onMouseMove(e: MouseEvent) {
		if (!this.dragging || !this.placeholder || !this.currentContainer) return;
		e.preventDefault();

		this.dragging.style.top = (e.clientY - this.offsetY) + "px";

		const siblings = Array.from(
			this.currentContainer.querySelectorAll<HTMLElement>(":scope > .nav-file")
		).filter(el => el !== this.dragging);

		let inserted = false;
		for (const sibling of siblings) {
			const rect = sibling.getBoundingClientRect();
			if (e.clientY < rect.top + rect.height / 2) {
				this.currentContainer.insertBefore(this.placeholder, sibling);
				inserted = true;
				break;
			}
		}
		if (!inserted) this.currentContainer.appendChild(this.placeholder);
	}

	// ─── Global mouse up ──────────────────────────────────────────────────────

	private async onMouseUp(e: MouseEvent) {
		console.log("mouseup fired", this.dragging);
		if (!this.dragging || !this.placeholder || !this.currentContainer) return;
		e.preventDefault();
		e.stopPropagation();

		const dragging = this.dragging;
		const placeholder = this.placeholder;
		const container = this.currentContainer;
		const folderPath = this.currentFolderPath;

		// Reset dragging state first
		this.dragging = null;
		this.placeholder = null;
		this.currentContainer = null;

		// Reset element styles
		dragging.style.position = "";
		dragging.style.zIndex = "";
		dragging.style.width = "";
		dragging.style.opacity = "";
		dragging.style.pointerEvents = "";
		dragging.style.top = "";
		dragging.style.left = "";
		dragging.style.background = "";
		dragging.style.borderRadius = "";
		dragging.style.boxShadow = "";
		dragging.style.cursor = "grab";

		const next = placeholder.nextSibling;
		placeholder.remove();
		container.insertBefore(dragging, next);

		// Save new order
		const newOrder = Array.from(
			container.querySelectorAll<HTMLElement>(":scope > .nav-file")
		).map(el => {
			return el.querySelector<HTMLElement>(".nav-file-title")?.dataset.path ?? "";
		}).filter(Boolean);

		await this.saveOrder(folderPath, newOrder);
		this.isDragging = false;
		this.startObserver();
	}

	// ─── Apply saved order ────────────────────────────────────────────────────

	private applySavedOrder(container: HTMLElement, folderPath: string) {
		const savedOrder = this.data[folderPath];
		if (!savedOrder || savedOrder.length === 0) return;

		const fileEls = Array.from(
			container.querySelectorAll<HTMLElement>(":scope > .nav-file")
		);

		const sorted = [...fileEls].sort((a, b) => {
			const pathA = a.querySelector<HTMLElement>(".nav-file-title")?.dataset.path ?? "";
			const pathB = b.querySelector<HTMLElement>(".nav-file-title")?.dataset.path ?? "";
			const iA = savedOrder.indexOf(pathA);
			const iB = savedOrder.indexOf(pathB);
			if (iA === -1 && iB === -1) return 0;
			if (iA === -1) return 1;
			if (iB === -1) return -1;
			return iA - iB;
		});

		sorted.forEach(el => container.appendChild(el));
	}

	// ─── MutationObserver ─────────────────────────────────────────────────────

	private startObserver() {
		const fileExplorer = this.getFileExplorerContainer();
		if (!fileExplorer) return;

		let timeout: ReturnType<typeof setTimeout>;

		this.observer = new MutationObserver(() => {
			if (this.isDragging) return;
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				this.injectFileExplorer();
			}, 1);
		});

		this.observer.observe(fileExplorer, { childList: true, subtree: true });
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────

	private getFileExplorerContainer(): HTMLElement | null {
		const leaves = this.app.workspace.getLeavesOfType("file-explorer");
		if (!leaves.length) return null;
		const view = leaves[0]?.view as any;
		return view?.containerEl ?? null;
	}

	private getFolderPathFromEl(folderEl: HTMLElement): string | null {
		const titleEl = folderEl.querySelector<HTMLElement>(".nav-folder-title");
		return titleEl?.dataset.path ?? null;
	}

	// ─── Persistence ──────────────────────────────────────────────────────────

	async saveOrder(folderPath: string, order: string[]) {
		this.data[folderPath] = order;
		await this.saveData_();
	}

	private async loadData_() {
		const saved = await this.loadData();
		this.data = saved || {};
	}

	private async saveData_() {
		await this.saveData(this.data);
	}

	onunload() {
		this.observer?.disconnect();
		this.dragging = null;
		this.placeholder = null;
	}
}