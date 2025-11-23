import CONSTANTS from '../module/constants.js';

export class PDFConverter {
	static initialize() {
		Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
			if (!game.user.isGM && !sheet.actor.isOwner) return;

			// Add "Sync PDF" button
			buttons.unshift({
				label: "Sync PDF",
				class: "pdf-sync",
				icon: "fas fa-file-pdf",
				onclick: () => {
					new PDFConverter(sheet.actor).syncDialog();
				}
			});
		});
	}

	constructor(actor) {
		this.actor = actor;
	}

	async syncDialog() {
		new Dialog({
			title: "Sync PDF to Sheet",
			content: `<p>This will attempt to read form fields from the actor's PDF and populate the standard 5e sheet.</p><p><strong>Warning:</strong> This will overwrite current actor data.</p>`,
			buttons: {
				sync: {
					label: "Sync Data",
					icon: "<i class='fas fa-sync'></i>",
					callback: () => this.performSync()
				},
				cancel: {
					label: "Cancel",
					icon: "<i class='fas fa-times'></i>"
				}
			},
			default: "sync"
		}).render(true);
	}

	async performSync() {
		try {
			// 1. Get PDF Path
			// 'pdf-sheets' module likely stores the path in flags. 
			// Based on common practices: actor.flags['pdf-sheets'].pdfUrl or similar.
			// We'll try to find it.
			let pdfPath = this.actor.getFlag('pdf-sheets', 'pdfUrl') ||
				this.actor.getFlag('pdf-sheets', 'src') ||
				this.actor.getFlag('pdf-sheets', 'filePath');

			if (!pdfPath) {
				// Fallback: Check if the sheet configuration points to a PDF
				// Or ask user? For now, warn.
				ui.notifications.warn("Could not find a linked PDF file for this actor.");
				return;
			}

			// 2. Load PDF
			// Foundry exposes pdfjsLib global
			if (typeof pdfjsLib === 'undefined') {
				ui.notifications.error("PDF.js library not found.");
				return;
			}

			const loadingTask = pdfjsLib.getDocument(pdfPath);
			const pdfDocument = await loadingTask.promise;

			// 3. Extract Form Data
			const formData = {};
			for (let i = 1; i <= pdfDocument.numPages; i++) {
				const page = await pdfDocument.getPage(i);
				const annotations = await page.getAnnotations();
				for (const annotation of annotations) {
					if (annotation.fieldName && annotation.fieldValue !== undefined) {
						formData[annotation.fieldName] = annotation.fieldValue;
					}
				}
			}

			if (Object.keys(formData).length === 0) {
				ui.notifications.warn("No form data found in the PDF.");
				return;
			}

			// 4. Map Data to 5e System
			const updates = this.mapDataToSystem(formData);

			// 5. Update Actor
			await this.actor.update(updates);
			ui.notifications.info("Actor data synced from PDF!");

		} catch (error) {
			console.error(error);
			ui.notifications.error("Error syncing PDF data. Check console for details.");
		}
	}

	mapDataToSystem(formData) {
		const system = {};
		const flatUpdates = {};

		// Helper to set value if exists
		const set = (path, val) => {
			if (val !== undefined && val !== null && val !== "") {
				flatUpdates[path] = val;
			}
		};

		// --- MAPPING LOGIC (Heuristic) ---
		// We look for common field names found in 5e PDFs (official and generic)

		// Abilities
		set('system.abilities.str.value', Number(formData['STR'] || formData['Strength'] || formData['Str']));
		set('system.abilities.dex.value', Number(formData['DEX'] || formData['Dexterity'] || formData['Dex']));
		set('system.abilities.con.value', Number(formData['CON'] || formData['Constitution'] || formData['Con']));
		set('system.abilities.int.value', Number(formData['INT'] || formData['Intelligence'] || formData['Int']));
		set('system.abilities.wis.value', Number(formData['WIS'] || formData['Wisdom'] || formData['Wis']));
		set('system.abilities.cha.value', Number(formData['CHA'] || formData['Charisma'] || formData['Cha']));

		// Attributes
		set('system.attributes.hp.value', Number(formData['HP'] || formData['HPCurrent'] || formData['CurrentHP']));
		set('system.attributes.hp.max', Number(formData['HPMax'] || formData['HPMax'] || formData['MaxHP']));
		set('system.attributes.ac.value', Number(formData['AC'] || formData['ArmorClass']));
		set('system.attributes.speed.value', formData['Speed']);
		set('system.attributes.init.bonus', Number(formData['Initiative'] || formData['Init']));

		// Details
		set('name', formData['CharacterName'] || formData['Name']);
		set('system.details.race', formData['Race']);
		set('system.details.background', formData['Background']);
		set('system.details.alignment', formData['Alignment']);
		set('system.details.xp.value', Number(formData['XP'] || formData['Experience']));
		set('system.details.level', Number(formData['Level'] || formData['ClassLevel'])); // Might need parsing "Fighter 1"

		// Bio
		set('system.details.biography.value', formData['Backstory'] || formData['BackgroundHistory']);
		set('system.details.appearance', formData['Appearance']);
		set('system.details.trait', formData['PersonalityTraits']);
		set('system.details.ideal', formData['Ideals']);
		set('system.details.bond', formData['Bonds']);
		set('system.details.flaw', formData['Flaws']);

		// Clothing System Integration (If PDF has these fields)
		// We update the flags directly here if we find them
		const clothingSlots = ['Head', 'Necklace', 'Chest', 'Arms', 'Abdomen', 'Hips', 'Legs', 'Misc'];
		const clothingUpdates = {};
		let hasClothingUpdates = false;

		for (const slot of clothingSlots) {
			const val = formData[`Clothing.${slot}`] || formData[slot]; // Try "Clothing.Head" or just "Head"
			if (val) {
				// We can't create a real Item from just a string, but we can store the name?
				// The Clothing System expects an object with {name, img, id}.
				// We'll create a placeholder object.
				clothingUpdates[`flags.${CONSTANTS.MODULE_NAME}.clothing.${slot.toLowerCase()}`] = {
					name: val,
					img: "icons/svg/item-bag.svg", // Default icon
					id: foundry.utils.randomID()
				};
				hasClothingUpdates = true;
			}
		}

		if (hasClothingUpdates) {
			Object.assign(flatUpdates, clothingUpdates);
		}

		return flatUpdates;
	}
}
