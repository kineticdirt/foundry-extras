import CONSTANTS from '../module/constants.js';
import { ClothingManager } from './clothing-manager.js';

export class ClothingSystem extends FormApplication {
	constructor(object, options) {
		super(object, options);
		this.document = object.document || object; // Handle Token (placeable) vs TokenDocument vs Actor
		// If it's a Token, we get the actor from it. If it's an Actor, it is the actor.
		this.actor = this.document.actor || this.document;
	}

	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			id: 'clothing-sheet',
			title: 'Clothing System',
			template: `modules/${CONSTANTS.MODULE_NAME}/templates/clothing-sheet.hbs`,
			width: 400,
			height: 'auto',
			resizable: true,
			dragDrop: [{ dragSelector: ".item", dropSelector: ".drop-zone" }]
		});
	}

	getData() {
		return {
			sections: ClothingManager.getClothingData(this.document),
			isToken: this.document instanceof TokenDocument
		};
	}

	async _onDrop(event) {
		const data = TextEditor.getDragEventData(event);
		const slotKey = event.target.closest('.clothing-slot')?.dataset.slot;
		await ClothingManager.handleDrop(this.document, this.actor, slotKey, data);
		this.render(true);
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find('.item-delete').click(this._onRemoveItem.bind(this));
	}

	async _onRemoveItem(event) {
		const slotKey = event.currentTarget.closest('.clothing-slot').dataset.slot;
		await ClothingManager.removeItem(this.document, slotKey);
		this.render(true);
	}

	static initialize() {
		// ============================================
		// ACTOR SHEET BUTTON - Adds "Clothing" button to Actor Sheet header only
		// ============================================
		// This hook ONLY fires for Actor sheets, NOT for Settings or other windows
		Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
			// Safety check: Only add to Actor sheets, not Settings or other windows
			if (!sheet || !sheet.actor || sheet.actor.documentName !== 'Actor') return;
			if (!game.user.isGM && !sheet.actor.isOwner) return;

			buttons.unshift({
				label: "Clothing",
				class: "clothing-system",
				icon: "fas fa-tshirt",
				onclick: () => {
					new ClothingSystem(sheet.actor).render(true);
				}
			});
		});

		// ============================================
		// TOKEN HUD ICON - Adds T-shirt icon to Token HUD when right-clicking a token
		// ============================================
		// This adds an icon to the Token HUD that triggers the ClothingHUD on the right side
		Hooks.on('renderTokenHUD', (app, html, data) => {
			const token = app.object; // The Token placeable
			const actor = token.actor;

			// Only show if actor exists and user has permission
			if (!actor || (!game.user.isGM && !actor.isOwner)) return;

			// Create the icon button
			const iconButton = $(`
				<div class="control-icon clothing-hud-trigger" 
					 data-token-id="${token.id}"
					 title="Clothing System">
					<i class="fas fa-tshirt"></i>
				</div>
			`);

			// Add click handler to trigger the ClothingHUD
			iconButton.on('click', (ev) => {
				ev.stopPropagation();
				// Bind the HUD to this token - this will show it on the right side
				if (ui.clothingHUD) {
					ui.clothingHUD.bind(token);
				}
			});

			// Add to the left column of Token HUD
			html.find('.col.left').append(iconButton);
		});
	}
}
