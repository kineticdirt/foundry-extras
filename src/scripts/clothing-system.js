import CONSTANTS from '../module/constants.js';

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
		// Read flags from the specific document (Token or Actor)
		const clothingData = this.document.getFlag(CONSTANTS.MODULE_NAME, 'clothing') || {};
		const slots = {
			head: { label: 'Headwear', item: null },
			necklace: { label: 'Necklace', item: null },
			chest: { label: 'Chest (Bra/Shirt)', item: null },
			arms: { label: 'Arms', item: null },
			abdomen: { label: 'Abdomen', item: null },
			hips: { label: 'Hips (Panties)', item: null },
			legs: { label: 'Legwear', item: null },
			misc: { label: 'Misc', item: null }
		};

		for (const [key, slot] of Object.entries(slots)) {
			if (clothingData[key]) {
				slot.item = clothingData[key];
			}
		}

		return {
			slots: slots,
			isToken: this.document instanceof TokenDocument
		};
	}

	async _onDrop(event) {
		const data = TextEditor.getDragEventData(event);
		const slotKey = event.target.closest('.clothing-slot')?.dataset.slot;

		if (!slotKey || data.type !== "Item") return;

		let item = await Item.fromDropData(data);
		if (!item) return;

		// Inventory Integration: Check if item is owned by this actor
		let ownedItem = item;
		if (item.parent !== this.actor) {
			// Create a copy in this actor's inventory
			const createdItems = await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
			ownedItem = createdItems[0];
			ui.notifications.info(`Added ${ownedItem.name} to inventory.`);
		}

		// Store item data in the slot
		const itemData = {
			id: ownedItem.id,
			name: ownedItem.name,
			img: ownedItem.img,
			uuid: ownedItem.uuid
		};

		// Save flag to the specific document (Token or Actor)
		await this.document.setFlag(CONSTANTS.MODULE_NAME, `clothing.${slotKey}`, itemData);
		this.render(true);
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find('.item-delete').click(this._onRemoveItem.bind(this));
	}

	async _onRemoveItem(event) {
		const slotKey = event.currentTarget.closest('.clothing-slot').dataset.slot;
		await this.document.unsetFlag(CONSTANTS.MODULE_NAME, `clothing.${slotKey}`);
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

		// Add button to Token HUD
		Hooks.on('renderTokenHUD', (app, html, data) => {
			console.log("ClothingSystem | renderTokenHUD hook fired");
			const token = app.object; // This is the Token placeable
			const actor = token.actor;

			if (!actor) {
				console.log("ClothingSystem | No actor found for token");
				return;
			}

			if (!game.user.isGM && !actor.isOwner) {
				console.log("ClothingSystem | User is not owner/GM");
				return;
			}

			console.log("ClothingSystem | Adding button to HUD");

			const button = $(`
				<div class="control-icon clothing-system" title="Clothing (Token)">
					<img src="modules/${CONSTANTS.MODULE_NAME}/icons/tshirt.png" width="36" height="36" style="border:none; filter: invert(1);">
				</div>
			`);

			button.click(() => {
				// Pass the TokenDocument to allow token-specific storage
				new ClothingSystem(token.document).render(true);
			});

			// Add to left column as requested
			$(html).find('.col.left').append(button);
		});
	}
}


