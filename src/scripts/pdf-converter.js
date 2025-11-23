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
