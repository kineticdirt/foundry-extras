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
		// Add button to Actor Sheet header
		Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
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

		// Token HUD integration removed - ClothingHUD now renders independently on the right side
	}
}
