/**
 * ByLED Configurator - Module isolé pour intégration CMS
 * Aucune pollution du scope global, compatible avec PrestaShop, WordPress, etc.
 */
const ByLEDConfigurator = (function() {
    'use strict';
    
    // Configuration de base
    const API_BASE = '/modules/byledconfigurator/api';
    // Base des fichiers statiques du module (images, etc.)
    const ASSETS_BASE = '/modules/byledconfigurator/public';

/**
 * Convertit un chemin d'image venant de tes JSON (/public/...) en chemin module.
 * - /public/images/...  -> /modules/byledconfigurator/public/images/...
 * - images/...          -> /modules/byledconfigurator/public/images/...
 * - http(s)://...       -> inchangé
 * - /img/p/...          -> inchangé (images PrestaShop)
 */
function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/modules/')) return path;
  if (path.startsWith('/img/')) return path; // Images PrestaShop

  if (path.startsWith('/public/')) {
    return ASSETS_BASE + path.replace('/public', '');
  }

  // chemins relatifs type "images/products/xxx.png"
  if (!path.startsWith('/')) {
    return ASSETS_BASE + '/' + path;
  }

  return path;
}

    let rootContainer = null; // Container principal #byled-configurator

    /**
     * État global de la configuration utilisateur
     * Contient toutes les sélections en cours pour générer une configuration LED complète
     */
    let state = {
    selectedStrip: null,             // Ruban LED sélectionné (objet strip)
    length: 0,                       // Longueur totale en mètres
    selectedSupply: null,            // Alimentation sélectionnée
    selectedCable: null,             // Câble alimentation->contrôleur
    cableLength: 0,                  // Longueur du câble en mètres
    controllerCategory: null,        // Catégorie de contrôleur ('dynamic', 'stairs', etc.)
    selectedController: null,        // Contrôleur sélectionné
    selectedRemote: null,            // Télécommande sélectionnée
    controlModes: [],                // Modes de contrôle souhaités (['remote', 'wifi', etc.])
    selectedOptionalCable: null,     // Câble d'extension facultatif
    optionalCableLength: 0,          // Longueur du câble d'extension
    completedSteps: []               // Étapes réellement validées (pour stepper)
};

// ===============================================================
// SÉCURITÉ - PROTECTION XSS
// ===============================================================
/**
 * Échappe les caractères HTML dangereux pour éviter l'injection XSS
 * Convertit < > " ' & en entités HTML sûres
 * 
 * Utilisation: TOUJOURS utiliser cette fonction quand on insère du contenu 
 * dynamique provenant de l'API dans innerHTML
 * 
 * @param {string|null|undefined} str - La chaîne à sécuriser
 * @returns {string} La chaîne échappée (ou vide si null/undefined)
 * 
 * Exemple:
 *   escapeHTML('<script>alert("XSS")</script>')
 *   → '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 */
function escapeHTML(str) {
    if (str === null || str === undefined) {
        return '';
    }
    
    // Convertir en string si ce n'est pas déjà le cas
    const stringValue = String(str);
    
    // Utiliser textContent pour échapper automatiquement
    const div = document.createElement('div');
    div.textContent = stringValue;
    return div.innerHTML;
}

/**
 * Formatte et sécurise un nombre pour affichage
 * Évite NaN, Infinity, et formate avec décimales
 * 
 * @param {number|string} num - Le nombre à formater
 * @param {number} decimals - Nombre de décimales (défaut: 2)
 * @returns {string} Le nombre formaté
 * 
 * Exemple:
 *   safeNumber(58.25) → "58.25"
 *   safeNumber("abc") → "0.00"
 *   safeNumber(Infinity) → "0.00"
 */
function safeNumber(num, decimals = 2) {
    const parsed = parseFloat(num);
    if (isNaN(parsed) || !isFinite(parsed)) {
        return decimals === 0 ? '0' : '0.' + '0'.repeat(decimals);
    }
    return parsed.toFixed(decimals);
}

// ===============================================================
// MODAL DE CONFIRMATION
// ===============================================================
function createConfirmModal() {
    const modalHtml = `
        <div id="confirm-modal" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-icon">⚠️</span>
                    <h3 class="modal-title" id="modal-title"></h3>
                </div>
                <p class="modal-message" id="modal-message"></p>
                <div class="modal-actions">
                    <button class="modal-btn modal-btn-cancel" id="modal-cancel">Annuler</button>
                    <button class="modal-btn modal-btn-confirm" id="modal-confirm">Confirmer</button>
                </div>
            </div>
        </div>
    `;
    const configurator = document.getElementById('byled-configurator');
    if (configurator) {
        configurator.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}
/**
 * Affiche une modal de confirmation avec titre, message et callbacks
 * Utilisée pour confirmer le changement de ruban LED (réinitialise la config)
 * @param {string} title - Titre de la modal 
 * @param {string} message - Message explicatif
 * @param {Function} onConfirm  - Callback si l'utilisateur confirme
 * @param {Function} onCancel  - Callback si l'utilisateur annule
 */
function showConfirmModal(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Afficher la modal
    modal.classList.remove('hidden');
    
    // Gérer les clics
    const handleConfirm = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleOutsideClick);
        if (onConfirm) onConfirm();
    };
    
    const handleCancel = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleOutsideClick);
        if (onCancel) onCancel();
    };
    
    const handleOutsideClick = (e) => {
        if (e.target === modal) {
            handleCancel();
        }
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    modal.addEventListener('click', handleOutsideClick);
}

function resetConfiguration() {
    // Réinitialiser tout l'état sauf le ruban
    const currentStrip = state.selectedStrip;
    
    state = {
        selectedStrip: null,
        length: 0,
        selectedSupply: null,
        selectedCable: null,
        cableLength: 0,
        controllerCategory: null,
        selectedController: null,
        selectedRemote: null,
        controlModes: [],
        selectedOptionalCable: null,
        optionalCableLength: 0,
        selectedColorTemp: null,
        completedSteps: []
    };
    
    // Masquer toutes les sections suivantes
    document.getElementById('step-color-temp').classList.add('hidden');
    document.getElementById('step-length').classList.add('hidden');
    document.getElementById('step-supply').classList.add('hidden');
    document.getElementById('step-cable').classList.add('hidden');
    document.getElementById('step-controller-category').classList.add('hidden');
    const remotesContainer = document.getElementById('remotes-list-container');
    if (remotesContainer) {
        remotesContainer.classList.add('hidden');
    }
    
    const optionalCables = document.getElementById('step-optional-cables');
    if (optionalCables) {
        optionalCables.classList.add('hidden');
    }
    
    // Réinitialiser les checkboxes de modes de contrôle
    document.querySelectorAll('.control-mode-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Réinitialiser les catégories de contrôleurs
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Réinitialiser le stepper
    updateStepper(1);

    // Réinitialiser le slider de longueur à son minimum visuel
    const lengthInput = document.getElementById('length-input');
    const lengthDisplay = document.getElementById('length-display');
    if (lengthInput) {
        lengthInput.value = lengthInput.min || 0;
        updateSliderFill(lengthInput);
    }
    if (lengthDisplay) {
        lengthDisplay.textContent = 0;
    }
    
    // Mettre à jour le panier
    updateCart();
}

function setupEventListeners() {
    // Ecouter les changements de longueur avec debounce
    const lengthInput = document.getElementById('length-input');
    const lengthDisplay = document.getElementById('length-display');
    let lengthDebounceTimer = null;

    lengthInput.addEventListener('input', (e) => {
        const newLength = parseInt(e.target.value) || 0;
        state.length = newLength;

        // Mettre à jour l'affichage instantanément
        lengthDisplay.textContent = newLength;
        
        // Mettre à jour la couleur de la barre (remplissage noir progressif)
        updateSliderFill(lengthInput);
        
        // Mettre à jour les recommandations de réalimentation
        updatePowerFeedRecommendation(newLength);
        
        // Annuler le timer précédent
        if (lengthDebounceTimer) {
            clearTimeout(lengthDebounceTimer);
        }
        
        // Attendre 500ms après le dernier mouvement avant de recharger
        lengthDebounceTimer = setTimeout(() => {
            if (state.selectedStrip && state.length > 0) {
                // Marquer l'étape 3 comme complétée
                if (!state.completedSteps.includes(3)) {
                    state.completedSteps.push(3);
                }
                
                // Rester sur l'étape longueur (3) mais charger l'étape suivante disponible
                updateStepper(3);
                loadSupplies();
                loadControllerCategories();
                loadRemotes();
            }

            //Mettre à jour le panier
            updateCart();
        }, 500);
    });
    
    // Initialiser le remplissage du slider
    updateSliderFill(lengthInput);
    
    // Slider de longueur de câble avec debounce
    const cableLengthInput = document.getElementById('cable-length-input');
    const cableLengthDisplay = document.getElementById('cable-length-display');
    let cableDebounceTimer = null;
    
    cableLengthInput.addEventListener('input', () => {
        const newLength = parseFloat(cableLengthInput.value) || 0;
        cableLengthDisplay.textContent = newLength;
        
        // Annuler le timer précédent
        if (cableDebounceTimer) {
            clearTimeout(cableDebounceTimer);
        }
        
        // Attendre 500ms après le dernier mouvement avant de mettre à jour
        cableDebounceTimer = setTimeout(() => {
            state.cableLength = newLength;
            
            // Si longueur = 0, ne pas ajouter de câble au panier
            if (state.cableLength === 0) {
                state.selectedCable = null;
            }
            
            updateCart();
        }, 500);
    });
}

// ==============================================
// GESTION DES ERREURS
// ==============================================
function showError(message, containerId = null) {
    console.error(message);

    // Si un conteneur est fourni, afficher le message dedans
    if (containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
            <div class="error-message">
                <span class="error-icon">⚠️</span>
                <strong>Erreur de chargement</strong><br>
                <span class="error-details">
                    ${message}
                </span>
                <button onclick="location.reload()" class="retry-button">Recharger la page</button>
            </div>
            `;
        }
    }
}

/**
 * Réinitialise tous les boutons de sélection dans un conteneur
 * @param {string} containerSelector - Sélecteur du conteneur (ex: '#supplies-list')
 * @param {string} buttonSelector - Sélecteur du bouton (ex: '.supply-select-btn')
 */
function updateSelectionButtons(containerSelector, buttonSelector = '.supply-select-btn') {
    document.querySelectorAll(`${containerSelector} .product-card, ${containerSelector} .supply-card`).forEach(card => {
        card.classList.remove('selected');
        const btn = card.querySelector(buttonSelector);
        if (btn) {
            btn.classList.remove('selected');
            btn.textContent = 'Sélectionner';
        }
    });
}

/**
 * Marque une carte et son bouton comme sélectionnés
 * @param {HTMLElement} card - L'élément carte à marquer
 * @param {string} buttonSelector - Sélecteur du bouton
 */
function setSelectedButton(card, buttonSelector = '.supply-select-btn') {
    if (!card) return;
    
    card.classList.add('selected');
    const btn = card.querySelector(buttonSelector);
    if (btn) {
        btn.classList.add('selected');
        btn.textContent = 'Sélectionné';
    }
}

/**
 * Génère le HTML d'une image placeholder avec gradient et icône
 * @param {string} type - Type de produit ('strip', 'cable', 'controller', 'remote', 'supply', 'temp')
 * @param {Object} options - Options (stripType pour les rubans, isCartItem pour le panier, customBg pour un fond personnalisé)
 * @returns {string} HTML de l'image placeholder
 */
function createPlaceholderImage(type, options = {}) {
    const config = {
        strip: { gradient: options.stripType?.includes('RGB') ? 'gradient-rgb' : 'gradient-digital', icon: '💡' },
        cable: { gradient: 'gradient-cable', icon: '🔌' },
        controller: { gradient: 'gradient-controller', icon: '🎛️' },
        remote: { gradient: 'gradient-remote', icon: '🎮' },
        supply: { gradient: 'gradient-supply', icon: '⚡' },
        temp: { gradient: 'gradient-temp', icon: '🌡️' }
    };
    
    const { gradient, icon } = config[type] || config.strip;
    const imageClass = options.isCartItem ? 'cart-item-image' : 'product-image';
    const iconClass = options.isCartItem ? 'cart-item-icon' : 'product-icon';
    const bgStyle = options.customBg ? ` style="background: ${options.customBg};"` : '';
    return `<div class="${imageClass} ${gradient}"${bgStyle}><span class="${iconClass}">${icon}</span></div>`;
}

/**
 * Détermine la classe CSS du gradient pour un ruban LED
 * @param {Object} strip - Ruban LED avec propriété type
 * @returns {string} Classe CSS ('gradient-rgb' ou 'gradient-digital')
 */
function getStripGradientClass(strip) {
    return strip?.type?.includes('RGB') ? 'gradient-rgb' : 'gradient-digital';
}

/**
 * Détermine la couleur du thermomètre selon la température Kelvin
 * @param {number} kelvin - Température en Kelvin
 * @returns {string} Gradient CSS selon la température
 */
function getTempColor(kelvin) {
    if (kelvin <= 3500) {
        // Blanc chaud → Gradient orange
        return 'linear-gradient(135deg, #ff9944 0%, #ffb366 100%)';
    }
    if (kelvin <= 4500) {
        // Blanc naturel → Gradient blanc cassé
        return 'linear-gradient(135deg, #fff4e6 0%, #ffffff 100%)';
    }
    // Blanc froid → Gradient bleu clair
    return 'linear-gradient(135deg, #a8d5ff 0%, #c9e3ff 100%)';
}

// =====================================================
// SECTION : CHARGEMENT DE RUBANS LED 
// =====================================================
// Charge la liste des rubans LED depuis l'API
// et crée les cartes correspondantes
async function loadStrips() {
    try {
        const response = await fetch(`${API_BASE}/strips.php`);
        const strips = await response.json();

        const container = document.getElementById('strips-list');
        container.innerHTML = '';

        strips.forEach(strip => {
            const card = createStripCard(strip);
            container.appendChild(card);
            
        });
    } catch (error) {
        showError('Impossible de charger les rubans LED. Veuillez réessayer.', 'strips-list');
    }
}

function createStripCard(strip) {
    const card = document.createElement('div');
    card.className = 'product-card';

    // Générer une image (vraie ou placeholder)
    let imageHtml = '';
    if (strip.image_url) {
        imageHtml = `<div class="product-image has-image" style="background-image: url('${assetUrl(strip.image_url)}');">
        </div>`;
    } else {
        imageHtml = createPlaceholderImage('strip', { stripType: strip.type });
    }

    // Afficher les options de couleur si disponibles
    // Affichage simplifié demandé : uniquement nom + référence + prix

    card.innerHTML = `
        ${imageHtml}
        <div class="product-name">${escapeHTML(strip.name)}</div>
        <div class="product-details">
            Ref: ${escapeHTML(strip.reference || '')}
        </div>
        <div class="product-price">
            ${safeNumber(strip.price)}€/${escapeHTML(strip.price_unit) === 'meter' ? 'm' : 'rouleau'}
        </div>
        <button class="supply-select-btn">Sélectionner</button>
    `;

    // Ajouter l'évènement onclick au bouton
    const btn = card.querySelector('.supply-select-btn');
    btn.onclick = (e) => {
        e.stopPropagation();
        selectStrip(strip, e);
    };

    return card;
}

function selectStrip(strip, event) {
    const clickedCard = event.target.closest('.product-card');
    
    // Toggle : si déjà sélectionné, déselectionner
    if (state.selectedStrip?.id === strip.id) {
        state.selectedStrip = null;
        state.selectedColorTemp = null;
        if (clickedCard) {
            clickedCard.classList.remove('selected');
        }
        
        document.getElementById('step-length').classList.add('hidden');
        updateCart();
        // Retirer l'étape 1 des étapes complétées et rafraîchir le stepper
        state.completedSteps = state.completedSteps.filter(s => s !== 1);
        updateStepper(1);
        
        // Réinitialiser tous les boutons
        document.querySelectorAll('#strips-list .product-card').forEach(c => {
            const btn = c.querySelector('.supply-select-btn');
            if (btn) {
                btn.classList.remove('selected');
                btn.textContent = 'Sélectionner';
            }
        })
        return;
    }
    
    // Si un autre ruban était déjà sélectionné, demander confirmation
    if (state.selectedStrip && state.selectedStrip.id !== strip.id) {
        showConfirmModal(
            'Changer de ruban LED ?',
            'Vous avez déjà une configuration en cours. Changer de ruban réinitialisera tous vos choix (alimentation, contrôleur, câbles, etc.).',
            () => {
                // Confirmation : réinitialiser et continuer
                resetConfiguration();
                proceedWithStripSelection(strip, clickedCard);
            },
            () => {
                // Annulation : ne rien faire
                return;
            }
        );
        return;
    }
    
    // Première sélection ou changement confirmé
    proceedWithStripSelection(strip, clickedCard);
}

/**
 * Finalise la sélection d'un ruban LED et configure les étapes suivantes
 * - Configure le slider de longueur (incréments selon type de vente)
 * - Affiche l'étape température de couleur si le ruban a des options
 * - Pré-charge les alimentations, contrôleurs et télécommandes compatibles
 * @param {Object} strip - Ruban LED sélectionné avec ses propriétés (type, voltage, power_per_meter, etc.)
 * @param {HTMLElement|null} clickedCard - Élément DOM de la carte cliquée (peut être null)
 */
function proceedWithStripSelection(strip, clickedCard) {
    state.selectedStrip = strip;
    state.selectedColorTemp = null;
    
    // Marquer l'étape 1 comme complétée
    if (!state.completedSteps.includes(1)) {
        state.completedSteps.push(1);
    }

    // Mettre à jour l'affichage des cartes et boutons
    updateSelectionButtons('#strips-list');
    setSelectedButton(clickedCard);

    // Configurer le slider selon le type de vente
    const lengthInput = document.getElementById('length-input');
    const lengthDisplay = document.getElementById('length-display');
    const markersContainer = document.getElementById('length-markers');

    if (strip.price_unit === 'meter') {
        // Vendu au mètre : incrément de 1m
        lengthInput.min = 1;
        lengthInput.max = 25;
        lengthInput.step = 1;
        lengthInput.value = 1;
        
        // Repères uniquement début et fin
        markersContainer.innerHTML = `
            <span class="marker-0">1m</span>
            <span class="marker-100">25m</span>
        `;
    } else {
        // Vendu au rouleau : incrément de 5m (rouleaux)
        lengthInput.min = 5;
        lengthInput.max = 25;
        lengthInput.step = 5;
        lengthInput.value = 5;
        
        // Repères tous les 5m
        markersContainer.innerHTML = `
            <span style="left: 0%;">5m</span>
            <span style="left: 25%;">10m</span>
            <span style="left: 50%;">15m</span>
            <span style="left: 75%;">20m</span>
            <span style="left: 100%;">25m</span>
        `;
    }

    state.length = parseInt(lengthInput.value);
    lengthDisplay.textContent = state.length;

    // Afficher choix température si nécessaire
    const colorTempSection = document.getElementById('step-color-temp');
    const tempStepBubble = rootContainer.querySelector('.stepper-step[data-step="2"]');
    const tempStepLine = rootContainer.querySelector('.stepper-step[data-step="2"]').nextElementSibling;
    state.selectedColorTemp = null;
    
    if (strip.color_options && strip.color_options.length > 0) {
        // Ruban avec options : afficher température (avant longueur)
        tempStepBubble.style.display = 'flex';
        tempStepLine.style.display = 'block';
        updateStepper(2);
        showColorTempOptions(strip.color_options);
        colorTempSection.classList.remove('hidden');
        // Afficher aussi la longueur directement
        document.getElementById('step-length').classList.remove('hidden');
        updatePowerFeedRecommendation(state.length || 1);
    } else {
        // Ruban sans options : masquer la bulle température et passer directement à la longueur
        tempStepBubble.style.display = 'none';
        tempStepLine.style.display = 'none';
        colorTempSection.classList.add('hidden');
        updateStepper(3);
        document.getElementById('step-length').classList.remove('hidden');
        updatePowerFeedRecommendation(state.length || 1);
        updateCart();
        // Valider immédiatement l'étape longueur (valeur par défaut déjà définie)
        autoCompleteLengthStep();
    }

    // Mettre à jour le panier immédiatement
    updateCart();

    // Afficher toutes les sections dès la sélection du ruban
    document.getElementById('step-supply').classList.remove('hidden');
    document.getElementById('step-cable').classList.remove('hidden');
    document.getElementById('step-controller-category').classList.remove('hidden');
    
    const optionalCablesSection = document.getElementById('step-optional-cables');
    if (optionalCablesSection) {
        optionalCablesSection.classList.remove('hidden');
    }

    // Charger les produits compatibles
    if (state.length > 0) {
        loadSupplies();
        loadCables(); // Charger les câbles d'alimentation directement
        loadControllerCategories();
        loadRemotes();
        loadOptionalCables(); // Charger aussi les câbles facultatifs directement
    }
    
    // Mettre à jour le récapitulatif
    updateConfigSummary();
}

// ==================================================================
// CHARGEMENT DES ALIMENTATIONS
// ==================================================================
async function loadSupplies() {
    if (!state.selectedStrip || !state.length) return;

    try {
        // Sauvegarder l'alimentation précédemment sélectionnée (si existante)
        const previousSupplyId = state.selectedSupply?.id;
        
        // Calculer et afficher le wattage requis
        const requiredPower = (state.selectedStrip.power_per_meter * state.length).toFixed(1);
        const requiredPowerWithMargin = (requiredPower * 1.2).toFixed(1);
        document.getElementById('required-power-info').innerHTML = 
            `Votre installation nécessite <strong class="power-value">${requiredPower}W</strong> (<strong class="power-value">${requiredPowerWithMargin}W</strong> avec marge). `;

        const response = await fetch(
            `${API_BASE}/supplies-status.php?strip_id=${state.selectedStrip.id}&length=${state.length}`
        );
        const supplies = await response.json();

        const container = document.getElementById('supplies-list');
        container.innerHTML = '';

        // Filtrer pour n'afficher que les alimentations compatibles
        const compatibleSupplies = supplies.filter(supply => supply.compatible);
        
        // Trouver la recommandée
        const recommended = compatibleSupplies.find(supply => supply.recommended);
        
        // 12V : uniquement la recommandée
        // 24V : afficher la recommandée (Meanwell) + jusqu'à 2 alternatives compatibles
        let displaySupplies = recommended ? [recommended] : [];
        const is24v = recommended && recommended.voltage === 24;

        if (is24v) {
            const typesAdded = new Set();
            if (recommended?.type) {
                typesAdded.add((recommended.type || '').toLowerCase());
            }

            for (const supply of compatibleSupplies) {
                if (recommended && supply.id === recommended.id) continue;

                const typeKey = (supply.type || '').toLowerCase();
                if (!typesAdded.has(typeKey)) {
                    displaySupplies.push(supply);
                    typesAdded.add(typeKey);
                }

                // Limiter à 3 alimentations au total (1 recommandée + 2 compatibles)
                if (displaySupplies.length >= 3) break;
            }
        }

        displaySupplies.forEach(supply => {
            if (supply) {
                const card = createSupplyCard(supply);
                container.appendChild(card);
            }
        });

        // AUTO-UPDATE : Toujours sélectionner la recommandée après changement de longueur
        if (previousSupplyId && recommended) {
            // Sélectionner automatiquement l'alimentation recommandée pour ce métrage
            // (s'adapte en montant ET en descendant pour toujours avoir la meilleure alim)
            state.selectedSupply = recommended;
            
            // Marquer visuellement la recommandée comme sélectionnée
            setTimeout(() => {
                const card = container.querySelector(`[data-supply-id="${recommended.id}"]`);
                if (card) {
                    setSelectedButton(card);
                }
            }, 10);
            
            // Mettre à jour le panier
            updateCart();
        }

        // Afficher la section
        document.getElementById('step-supply').classList.remove('hidden');
    } catch (error) {
        showError('Impossible de charger les alimentations. Veuillez réessayer.', 'supplies-list');
    }
}

function createSupplyCard(supply) {
    const card = document.createElement('div');
    card.className = 'supply-card';
    card.setAttribute('data-supply-id', supply.id);

    if (!supply.compatible) {
        card.classList.add('incompatible');
    }

    // Badge de statut (Recommandé ou Compatible)
    const statusBadge = supply.recommended 
        ? '<div class="supply-status-badge recommended"><span class="badge-icon">✓</span> Recommandé</div>'
        : '<div class="supply-status-badge compatible">Compatible</div>';

    // Icône info (seulement si info existe)
    const infoIcon = supply.info 
        ? `<div class="supply-info-icon" data-tooltip="${supply.info}">ℹ️</div>`
        : '';

    // Image (vraie ou placeholder)
    let imageHtml = '';
    if (supply.image_url) {
        imageHtml = `<div class="supply-image"><img src="${assetUrl(supply.image_url)}" alt="${supply.name}"></div>`;
    } else {
        imageHtml = `<div class="supply-image supply-placeholder">
            <span class="supply-icon">⚡</span>
        </div>`;
    }

    // Badge de câblage (Câblage requis ou Pré-câblé)
    const wiringBadge = supply.wiring === 'cablage-requis'
        ? '<div class="supply-wiring-badge warning"><span class="warning-icon">▸</span> Câblage requis</div>'
        : '<div class="supply-wiring-badge success"><span class="check-icon">✓</span> Pré-câblé</div>';

    // Bouton de sélection
    const isSelected = state.selectedSupply && state.selectedSupply.id === supply.id;
    const buttonText = isSelected ? 'Sélectionné' : 'Sélectionner';
    const buttonClass = isSelected ? 'supply-select-btn selected' : 'supply-select-btn';

    card.innerHTML = `
        ${statusBadge}
        ${infoIcon}
        ${imageHtml}
        <div class="supply-name">${escapeHTML(supply.name)}</div>
        <div class="supply-reference">Réf: ${escapeHTML(supply.reference || 'N/A')}</div>
        <div class="supply-price">${safeNumber(supply.price)}€ TTC</div>
        ${wiringBadge}
        <button class="${buttonClass}">
            ${buttonText}
        </button>
    `;

    if (supply.compatible) {
        const btn = card.querySelector('.supply-select-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                selectSupplyById(supply.id, supply);
            };
        }
    }

    return card;
}

function selectSupplyById(supplyId, supplyData) {
    // Toggle : si déjà sélectionné, déselectionner
    if (state.selectedSupply?.id === supplyId) {
        state.selectedSupply = null;
        // Retirer l'étape 4 des étapes complétées
        state.completedSteps = state.completedSteps.filter(s => s !== 4);
        updateSelectionButtons('#supplies-list');
        document.getElementById('step-cable').classList.add('hidden');
        updateCart();
        updateConfigSummary();
        refreshStepper();
        return;
    }
    
    state.selectedSupply = supplyData;
    
    // Marquer l'étape 4 comme complétée
    if (!state.completedSteps.includes(4)) {
        state.completedSteps.push(4);
    }

    // Mettre à jour tous les boutons
    updateSelectionButtons('#supplies-list');

    // Mettre à jour le bouton de la carte sélectionnée
    const selectedCard = rootContainer.querySelector(`.supply-card[data-supply-id="${supplyId}"]`);
    setSelectedButton(selectedCard);

    updateStepper(5); // Passer à l'étape câbles
    loadCables();
    updateCart();
    updateWiringDiagram();
    updateConfigSummary();
}

// ==================================================================
// CHARGEMENT DES CÂBLES
// ==================================================================
async function loadCables() {
    try {
        const response = await fetch(`${API_BASE}/cables.php`);
        const cables = await response.json();
        
        const container = document.getElementById('cables-list');
        container.innerHTML = '';
        
        // Filtrer uniquement les câbles "power" (alimentation → contrôleur)
        const cablesPower = cables.filter(cable => cable.usage === 'power');
        
        cablesPower.forEach(cable => {
            const card = createCableCard(cable);
            container.appendChild(card);
        });
        
        document.getElementById('step-cable').classList.remove('hidden');
        
    } catch (error) {
        showError('Impossible de charger les câbles. Veuillez réessayer.', 'cables-list');
    }
}

function createCableCard(cable) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Image (vraie ou placeholder)
    let imageHtml = '';
    if (cable.image_url) {
        imageHtml = `<div class="product-image has-image" style="background-image: url('${assetUrl(cable.image_url)}');"></div>`;
    } else {
        imageHtml = createPlaceholderImage('cable');
    }
    
    // Bouton de sélection
    const isSelected = state.selectedCable && state.selectedCable.id === cable.id;
    const buttonText = isSelected ? 'Sélectionné' : 'Sélectionner';
    const buttonClass = isSelected ? 'supply-select-btn selected' : 'supply-select-btn';
    
    card.innerHTML = `
        ${imageHtml}
        <div class="product-name">${escapeHTML(cable.name)}</div>
        <div class="product-details">
            ${cable.wire_count} fils • Section: ${escapeHTML(cable.section)}mm²
        </div>
        <div class="product-price">${safeNumber(cable.price_per_meter)}€/m</div>
        <button class="${buttonClass}">
            ${buttonText}
        </button>
    `;
    
    const btn = card.querySelector('.supply-select-btn');
    if (btn) {
        btn.onclick = (e) => {
            e.stopPropagation();
            const selectedCard = e.target.closest('.product-card');
            selectCable(cable, selectedCard);
        };
    }
    
    return card;
}

function selectCable(cable, selectedCard) {
    // Toggle : si déjà sélectionné, déselectionner
    if (state.selectedCable?.id === cable.id) {
        state.selectedCable = null;
        state.cableLength = 0;
        // Retirer l'étape 5 des étapes complétées
        state.completedSteps = state.completedSteps.filter(s => s !== 5);
        updateSelectionButtons('#cables-list');
        document.getElementById('cable-length-selector').classList.add('hidden');
        updateCart();
        refreshStepper();
        return;
    }
    
    state.selectedCable = cable;
    state.cableLength = 1; // Valeur par défaut
    
    // Marquer l'étape 5 comme complétée
    if (!state.completedSteps.includes(5)) {
        state.completedSteps.push(5);
    }
    // Passer à l'étape suivante (contrôleur)
    updateStepper(6);
    
    // Mettre à jour tous les boutons
    updateSelectionButtons('#cables-list');
    
    // Sélectionner le bouton de la carte sélectionnée
    setSelectedButton(selectedCard);
    
    // Afficher le sélecteur de longueur
    const lengthSelector = document.getElementById('cable-length-selector');
    lengthSelector.classList.remove('hidden');
    
    // Réinitialiser le slider à 1m
    document.getElementById('cable-length-input').value = 1;
    document.getElementById('cable-length-display').textContent = 1;
    
    updateCart();
}

// ===========================================================
// CATÉGORIES DE CONTRÔLEURS
// ===========================================================
function loadControllerCategories() {
    const categories = [
        {
            id: 'dynamic',
            title: 'Allumage dynamique /',
            subtitle: 'progressif classique',
            description: 'Contrôle standard avec variation d\'intensité',
            image: '/public/images/categories/dynamic.png',
            icon: '💡'
        },
        {
            id: 'stairs',
            title: 'Escaliers',
            subtitle: '',
            description: 'Allumage séquentiel pour escaliers',
            image: '/public/images/categories/stairs.png',
            icon: '🎬'
        },
        {
            id: 'audio',
            title: 'Synchronisation',
            subtitle: 'audio-lumineuse',
            description: 'Réaction à la musique et au son',
            image: '/public/images/categories/audio.png',
            icon: '🎵'
        },
        {
            id: 'dmx',
            title: 'DMX512',
            subtitle: '(événementiel)',
            description: 'Contrôle professionnel DMX',
            image: '/public/images/categories/dmx.png',
            icon: '🎛️'
        }
    ];

    const container = document.getElementById('controller-categories');
    container.innerHTML = '';

    categories.forEach(category => {
        const card = createCategoryCard(category);
        container.appendChild(card);
    });

// Bouton "Afficher tous"
const showAllBtn = document.getElementById('show-all-controllers');
if (showAllBtn) {
    showAllBtn.onclick = (e) => {
        e.preventDefault();
        state.controllerCategory = null;
        
        // Retirer la classe selected de toutes les catégories
        document.querySelectorAll('.category-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        loadControllersAll();
    };
}

    // Charger les modes de contrôle
    loadControlModes();

    // Charger automatiquement tous les contrôleurs compatibles par défaut
    loadControllersAll();

    document.getElementById('step-controller-category').classList.remove('hidden');
}

// =================================================
// MODES DE CONTRÔLE
// =================================================
function loadControlModes() {
    const modes = [
        {
            id: 'remote',
            icon: '👋',
            label: 'Télécommande portative',
            color: '#4F46E5'
        },
        {
            id: 'button',
            icon: '👆',
            label: 'Bouton poussoir',
            color: '#10B981'
        },
        {
            id: 'motion',
            icon: '🎯',
            label: 'Détecteur de mouvement',
            color: '#8B5CF6'
        },
        {
            id: 'wifi',
            icon: '📶',
            label: 'WiFi / Smartphone',
            color: '#F59E0B'
        }
    ];

    const container = document.getElementById('control-modes');
    if (!container) return;
    
    container.innerHTML = '';

    modes.forEach(mode => {
        const checkbox = createControlModeCheckbox(mode);
        container.appendChild(checkbox);
    });
}

function createControlModeCheckbox(mode) {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-mode-option';
    wrapper.setAttribute('data-mode-id', mode.id);
    
    wrapper.innerHTML = `
        <label for="mode-${mode.id}" class="control-mode-label">
            <input type="checkbox" id="mode-${mode.id}" class="control-mode-checkbox" value="${mode.id}">
            <span class="control-mode-icon" style="color: ${mode.color};">${mode.icon}</span>
            <span class="control-mode-text">${mode.label}</span>
        </label>
    `;
    
    const checkbox = wrapper.querySelector('input');
    checkbox.onchange = (e) => {
        handleControlModeChange(mode.id, e.target.checked);
    };
    
    return wrapper;
}

function handleControlModeChange(modeId, checked) {
    if (!state.controlModes) {
        state.controlModes = [];
    }
    
    if (checked) {
        if (!state.controlModes.includes(modeId)) {
            state.controlModes.push(modeId);
        }
    } else {
        state.controlModes = state.controlModes.filter(id => id !== modeId);
    }
    
    // Recharger les contrôleurs si affichés
    const controllersContainer = document.getElementById('controllers-list-container');
    if (!controllersContainer.classList.contains('hidden')) {
        if (state.controllerCategory) {
            loadControllers(state.controllerCategory);
        } else {
            loadControllersAll();
        }
    }
    
    updateCart();
}

function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.onclick = (e) => selectControllerCategory(category.id, e);

    // Utiliser l'image si elle existe, sinon le gradient avec icône
    let imageClass = '';
    let imageStyle = '';
    if (category.image) {
        imageStyle = `background-image: url('${assetUrl(category.image)}');`;
    } else {
        imageClass = ' gradient';
    }

    card.innerHTML = `
        <div class="category-image${imageClass}" ${imageStyle ? `style="${imageStyle}"` : ''}>
            ${!category.image ? category.icon : ''}
        </div>
        <div class="category-card-content">
            <h4 class="category-card-title">
                ${escapeHTML(category.title)}${category.subtitle ? '<br>' + escapeHTML(category.subtitle) : ''}
            </h4>
            <p class="category-card-description">${escapeHTML(category.description)}</p>
        </div>
    `;

    return card;
}

function selectControllerCategory(categoryId, event) {
    state.controllerCategory = categoryId;
    
    // Retirer la classe selected de toutes les cartes
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Ajouter la classe selected à la carte cliquée
    const clickedCard = event.target.closest('.category-card');
    if (clickedCard) {
        clickedCard.classList.add('selected');

    }
    
    // Rester sur l'étape contrôleur tant qu'aucun contrôleur n'est choisi
    updateStepper(6);
    loadControllers(categoryId);
}

// ==============================================================
// CHARGEMENT DE TOUS LES CONTRÔLEURS (sans filtre)
// ==============================================================
async function loadControllersAll() {
    if (!state.selectedStrip || !state.length) {
        console.warn('Ruban ou longueur non sélectionné');
        return;
    }

    try {
        // Backend calcule la compatibilité TECHNIQUE (voltage, pixels, puce)
        const response = await fetch(
            `${API_BASE}/controllers-status.php?strip_id=${state.selectedStrip.id}&length=${state.length}`
        );
        const allControllers = await response.json();

        // Frontend filtre les préférences UTILISATEUR (control_modes)
        let displayControllers = allControllers.filter(item => item.compatible); // Uniquement les compatibles
        
        if (state.controlModes && state.controlModes.length > 0) {
            displayControllers = displayControllers.filter(item => {
                if (!item.control_modes || item.control_modes.length === 0) {
                    return false;
                }
                return state.controlModes.every(mode => item.control_modes.includes(mode));
            });
        }

        const container = document.getElementById('controllers-list');
        container.innerHTML = '';

        if (displayControllers.length === 0) {
            container.innerHTML = '<div class="no-results-message">Aucun contrôleur trouvé pour ces critères.</div>';
        } else {
            displayControllers.forEach(item => {
                const card = createControllerCard(item, item);
                container.appendChild(card);
            });
        }

        // Afficher le conteneur des contrôleurs dans la même section
        document.getElementById('controllers-list-container').classList.remove('hidden');

    } catch (error) {
        showError('Impossible de charger les contrôleurs. Veuillez réessayer.', 'controllers-list');
    }
}

// ==============================================================
// CHARGEMENT DES CONTRÔLEURS (avec filtre)
// ==============================================================
async function loadControllers(categoryFilter = null) {
    if (!state.selectedStrip || !state.length) {
        console.warn('Ruban ou longueur non sélectionné');
        return;
    }

    try {
        // Mapper les catégories vers les valeurs "usage"
        const usageMapping = {
            'dynamic': 'Classic',
            'stairs': 'Escaliers',
            'audio': 'Musical',
            'dmx': 'DMX512'
        };
        
        // Backend calcule la compatibilité TECHNIQUE
        const response = await fetch(
            `${API_BASE}/controllers-status.php?strip_id=${state.selectedStrip.id}&length=${state.length}`
        );
        const allControllers = await response.json();

        // Filtrer par usage (catégorie) ET control_modes (préférences)
        let displayControllers = allControllers.filter(item => item.compatible); // Uniquement les compatibles
        
        // Filtre 1 : Usage/catégorie
        if (categoryFilter && usageMapping[categoryFilter]) {
            const targetUsage = usageMapping[categoryFilter];
            displayControllers = displayControllers.filter(item => {
                const usages = Array.isArray(item.usage) 
                    ? item.usage 
                    : [item.usage];
                return usages.includes(targetUsage);
            });
        }
        
        // Filtre 2 : Control modes
        if (state.controlModes && state.controlModes.length > 0) {
            displayControllers = displayControllers.filter(item => {
                if (!item.control_modes || item.control_modes.length === 0) {
                    return false;
                }
                return state.controlModes.every(mode => item.control_modes.includes(mode));
            });
        }

        const container = document.getElementById('controllers-list');
        container.innerHTML = '';

        if (displayControllers.length === 0) {
            container.innerHTML = '<div class="no-results-message">Aucun contrôleur trouvé pour ces critères.</div>';
        } else {
            displayControllers.forEach(item => {
                const card = createControllerCard(item, item);
                container.appendChild(card);
            });
        }

        // Afficher le conteneur des contrôleurs dans la même section
        document.getElementById('controllers-list-container').classList.remove('hidden');

    } catch (error) {
        showError('Impossible de charger les contrôleurs. Veuillez réessayer.', 'controllers-list');
    }
}

function createControllerCard(controller, statusData = null) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Gérer compatibilité et recommandation
    const isCompatible = statusData ? statusData.compatible : true;
    const isRecommended = statusData ? statusData.recommended : false;
    const incompatibleReason = statusData?.reason || null;
    
    if (!isCompatible) {
        card.classList.add('incompatible');
    }
    
    // Image (vraie ou placeholder)
    let imageHtml = '';
    if (controller.image_url) {
        imageHtml = `<div class="product-image has-image" style="background-image: url('${assetUrl(controller.image_url)}');"></div>`;
    } else {
        imageHtml = createPlaceholderImage('controller');
    }
    
    // Badge recommandé
    let recommendedBadge = '';
    if (isRecommended && isCompatible) {
        recommendedBadge = '<div class="supply-status-badge recommended"><span class="badge-icon">✓</span> Recommandé</div>';
    }
    
    // Icône info (seulement si info existe)
    const infoIcon = controller.info 
        ? `<div class="supply-info-icon" data-tooltip="${controller.info}">ℹ️</div>`
        : '';
    
    // Badge incompatible avec raison
    let incompatibleBadge = '';
    if (!isCompatible && incompatibleReason) {
        incompatibleBadge = `<div class="incompatible-reason">${incompatibleReason}</div>`;
    }
    
    // Badges d'usage
    let usageBadgesHtml = '';
    if (controller.usage) {
        const usages = Array.isArray(controller.usage) ? controller.usage : [controller.usage];
        const badgesHtml = usages.map(usage => {
            const usageClass = usage.toLowerCase();
            return `<span class="usage-badge ${usageClass}">${usage}</span>`;
        }).join('');
        usageBadgesHtml = `<div class="product-usage-badges">${badgesHtml}</div>`;
    }
    
    // Bouton de sélection
    const isSelected = state.selectedController && state.selectedController.id === controller.id;
    const buttonText = isSelected ? 'Sélectionné' : 'Sélectionner';
    const buttonClass = isSelected ? 'supply-select-btn selected' : 'supply-select-btn';
    
    // Référence produit
    const referenceHtml = controller.reference 
        ? `<div class="product-reference">Réf: ${escapeHTML(controller.reference)}</div>`
        : '';
    
    card.innerHTML = `
        ${recommendedBadge}
        ${infoIcon}
        ${imageHtml}
        <div class="product-name">
            ${escapeHTML(controller.name)}
        </div>
        ${usageBadgesHtml}
        ${referenceHtml}
        <div class="product-price">${safeNumber(controller.price)}€</div>
        ${incompatibleBadge}
        <button class="${buttonClass}">
            ${buttonText}
        </button>
    `;
    
    if (isCompatible) {
        const btn = card.querySelector('.supply-select-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                const selectedCard = e.target.closest('.product-card');
                selectController(controller, selectedCard);
            };
        }
    }
    
    return card;

}

function selectController(controller, selectedCard) {
    // Toggle : si déjà sélectionné, déselectionner
    if (state.selectedController?.id === controller.id) {
        state.selectedController = null;
        // Retirer l'étape 6 des étapes complétées
        state.completedSteps = state.completedSteps.filter(s => s !== 6);
        updateSelectionButtons('#controllers-list');
        const remotesContainer = document.getElementById('remotes-list-container');
        if (remotesContainer) {
            remotesContainer.classList.add('hidden');
        }
        updateCart();
        updateWiringDiagram();
        updateConfigSummary();
        refreshStepper();
        return;
    }
    
    state.selectedController = controller;
    
    // Marquer l'étape 6 comme complétée
    if (!state.completedSteps.includes(6)) {
        state.completedSteps.push(6);
    }

    // Mettre à jour tous les boutons
    updateSelectionButtons('#controllers-list');
    
    // Sélectionner le bouton de la carte sélectionnée
    setSelectedButton(selectedCard);

    updateStepper(7); // Passer à l'étape télécommande
    loadRemotes();
    updateCart();
    updateWiringDiagram();
    updateConfigSummary();
}

// =============================================================
// CHARGEMENT DES TÉLÉCOMMANDES
// =============================================================
async function loadRemotes() {
    if (!state.selectedStrip || !state.length) return;

    try {
        // Construire l'URL avec controller_id si disponible
        let url = `${API_BASE}/remotes-status.php?strip_id=${state.selectedStrip.id}&length=${state.length}`;
        if (state.selectedController) {
            url += `&controller_id=${state.selectedController.id}`;
        }
        
        const response = await fetch(url);
        const remotes = await response.json();

        const container = document.getElementById('remotes-list');
        container.innerHTML = '';
        
        // Filtrer les télécommandes selon le contrôleur sélectionné
        let filteredRemotes = remotes;
        if (state.selectedController && state.selectedController.reference) {
            const controllerRef = state.selectedController.reference;
            filteredRemotes = remotes.filter(remote => {
                // La télécommande doit avoir une liste de compatibilité et contenir le contrôleur actuel
                if (!remote.compatible_with_controllers || remote.compatible_with_controllers.length === 0) {
                    return false;
                }
                // Vérifier si le contrôleur actuel est compatible
                // La référence du contrôleur peut contenir la référence courte (ex: COM-DIG-RGBW-SPIR3-M contient SPIR3-M)
                return remote.compatible_with_controllers.some(compatRef => 
                    controllerRef.includes(compatRef) || compatRef.includes(controllerRef)
                );
            });
        }
        
        if (filteredRemotes.length === 0) {
            container.innerHTML = '<p class="empty-message">Aucune télécommande compatible avec ce contrôleur.</p>';
            document.getElementById('remotes-list-container').classList.remove('hidden');
            // Si aucune télécommande n'est disponible, considérer l'étape 7 comme complétée et passer à l'étape 8
            if (!state.completedSteps.includes(7)) {
                state.completedSteps.push(7);
            }
            updateStepper(8);
            return;
        }

        filteredRemotes.forEach(remote => {
            const card = createRemoteCard(remote);
            container.appendChild(card);
        });

        // Afficher le conteneur des télécommandes dans la section contrôle
        document.getElementById('remotes-list-container').classList.remove('hidden');

    } catch (error) {
        showError('Impossible de charger les télécommandes. Veuillez réessayer.', 'remotes-list');
    }
}

function createRemoteCard(remote) {
    const card = document.createElement('div');
    card.className = 'product-card';

    if (!remote.compatible) {
        card.classList.add('incompatible');
    }

    // Image (vraie ou placeholder)
    let imageHtml = '';
    if (remote.image_url) {
        imageHtml = `<div class="product-image has-image" style="background-image: url('${assetUrl(remote.image_url)}');"></div>`;
    } else {
        imageHtml = createPlaceholderImage('remote');
    }

    // Bouton de sélection
    const isSelected = state.selectedRemote && state.selectedRemote.id === remote.id;
    const buttonText = isSelected ? 'Sélectionné' : 'Sélectionner';
    const buttonClass = isSelected ? 'supply-select-btn selected' : 'supply-select-btn';
    
    card.innerHTML = `
        ${imageHtml}
        <div class="product-name">
            ${escapeHTML(remote.name)}
            ${remote.recommended ? '<span class="product-badge">⭐ Recommandée</span>' : ''}
        </div>
        <div class="product-details">
            ${escapeHTML(remote.control_type)}
        </div>
        <div class="product-price">${safeNumber(remote.price)}€</div>
        ${remote.reason ? `<div class="product-reason">${escapeHTML(remote.reason)}</div>` : ''}
        <button class="${buttonClass}">
            ${buttonText}
        </button>
    `;
    
    if (remote.compatible) {
        const btn = card.querySelector('.supply-select-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                const selectedCard = e.target.closest('.product-card');
                selectRemote(remote, selectedCard);
            };
        }
    }

    return card;
}

function selectRemote(remote, selectedCard) {
    // Toggle : si déjà sélectionné, déselectionner
    if (state.selectedRemote?.id === remote.id) {
        state.selectedRemote = null;
        // Retirer l'étape 7 des étapes complétées
        state.completedSteps = state.completedSteps.filter(s => s !== 7);
        updateSelectionButtons('#remotes-list');
        updateCart();
        updateWiringDiagram();
        updateConfigSummary();
        refreshStepper();
        return;
    }
    
    state.selectedRemote = remote;
    
    // Marquer l'étape 7 comme complétée
    if (!state.completedSteps.includes(7)) {
        state.completedSteps.push(7);
    }

    // Mettre à jour tous les boutons
    updateSelectionButtons('#remotes-list');
    
    // Sélectionner le bouton de la carte sélectionnée
    setSelectedButton(selectedCard);
    
    // Passer à l'étape suivante (câble extension facultatif)
    updateStepper(8);

    updateCart();
    updateWiringDiagram();
    updateConfigSummary();
}

// ============================================
// ÉTAPE 6 BIS : CÂBLES D'EXTENSION (FACULTATIF)
// ============================================

async function loadOptionalCables() {
    try {
        const response = await fetch(`${API_BASE}/cables.php`);
        const allCables = await response.json();
        
        // Filtrer uniquement les câbles "extension" (contrôleur → ruban)
        const extensionCables = allCables.filter(cable => cable.usage === 'extension');
        
        // Récupérer le wire_count du ruban sélectionné
        const stripWireCount = state.selectedStrip?.wire_count;
        
        if (!stripWireCount) {
            console.warn('Aucun ruban sélectionné, impossible de filtrer les câbles');
            return;
        }
        
        // Filtrer les câbles correspondant au nombre de fils du ruban
        const compatibleCables = extensionCables.filter(cable => cable.wire_count === stripWireCount);
        
        if (compatibleCables.length === 0) {
            console.info('Aucun câble d\'extension disponible pour ce type de ruban');
            return;
        }
        
        // Afficher l'étape
        const step = document.getElementById('step-optional-cables');
        step.classList.remove('hidden');
        
        // Créer le groupe de câbles
        const container = document.getElementById('optional-cables-groups');
        container.innerHTML = `
            <h3 style="margin-bottom: 15px; color: var(--text-dark);">
                Câbles ${stripWireCount} fils pour votre ruban ${state.selectedStrip.type}
            </h3>
            <div id="optional-cables-list" class="products-grid"></div>
        `;
        
        const list = document.getElementById('optional-cables-list');
        compatibleCables.forEach(cable => {
            const card = createOptionalCableCard(cable);
            list.appendChild(card);
        });
        
    } catch (error) {
        showError('Impossible de charger les câbles d\'extension. Vous pouvez continuer sans.', 'optional-cables-groups');
    }
}

function createOptionalCableCard(cable) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Image
    let imageHtml = '';
    if (cable.image_url) {
        imageHtml = `<div class="product-image has-image" style="background-image: url('${assetUrl(cable.image_url)}');"></div>`;
    } else {
        imageHtml = createPlaceholderImage('cable');
    }
    
    // Bouton de sélection
    const isSelected = state.selectedOptionalCable && state.selectedOptionalCable.id === cable.id;
    const buttonText = isSelected ? 'Sélectionné' : 'Sélectionner';
    const buttonClass = isSelected ? 'supply-select-btn selected' : 'supply-select-btn';
    
    card.innerHTML = `
        ${imageHtml}
        <div class="product-name">${escapeHTML(cable.name)}</div>
        <div class="product-details">
            ${cable.wire_count} fils • Section: ${escapeHTML(cable.section)}mm²
        </div>
        <div class="product-price">${safeNumber(cable.price_per_meter)}€/m</div>
        <button class="${buttonClass}">
            ${buttonText}
        </button>
    `;
    
    const btn = card.querySelector('.supply-select-btn');
    if (btn) {
        btn.onclick = (e) => {
            e.stopPropagation();
            const clickedCard = e.target.closest('.product-card');
            selectOptionalCable(cable, clickedCard);
        };
    }
    
    return card;
}

function selectOptionalCable(cable, clickedCard) {
    
    // Toggle : si déjà sélectionné, déselectionner
    if (state.selectedOptionalCable?.id === cable.id) {
        state.selectedOptionalCable = null;
        state.optionalCableLength = 0;
        // Retirer l'étape 8 des étapes complétées
        state.completedSteps = state.completedSteps.filter(s => s !== 8);
        updateSelectionButtons('#optional-cables-list');
        document.getElementById('optional-cable-length-selector').classList.add('hidden');
        updateCart();
        refreshStepper();
        return;
    }
    
    state.selectedOptionalCable = cable;
    state.optionalCableLength = 1; // Valeur par défaut
    
    // Marquer l'étape 8 comme complétée
    if (!state.completedSteps.includes(8)) {
        state.completedSteps.push(8);
    }
    
    // Mettre à jour tous les boutons
    updateSelectionButtons('#optional-cables-list');
    setSelectedButton(clickedCard);
    
    // Afficher le sélecteur de longueur
    const lengthSelector = document.getElementById('optional-cable-length-selector');
    lengthSelector.classList.remove('hidden');
    
    // Réinitialiser le slider à 1m
    const optionalCableLengthInput = document.getElementById('optional-cable-length-input');
    const optionalCableLengthDisplay = document.getElementById('optional-cable-length-display');
    optionalCableLengthInput.value = 1;
    optionalCableLengthDisplay.textContent = 1;
    
    // Configurer l'event listener pour le slider (une seule fois)
    if (!optionalCableLengthInput.dataset.listenerSet) {
        let optionalCableDebounceTimer = null;
        
        optionalCableLengthInput.addEventListener('input', () => {
            const newLength = parseFloat(optionalCableLengthInput.value) || 0;
            optionalCableLengthDisplay.textContent = newLength;
            
            if (optionalCableDebounceTimer) {
                clearTimeout(optionalCableDebounceTimer);
            }
            
            optionalCableDebounceTimer = setTimeout(() => {
                state.optionalCableLength = newLength;
                
                if (state.optionalCableLength === 0) {
                    state.selectedOptionalCable = null;
                }
                
                updateCart();
            }, 500);
        });
        
        optionalCableLengthInput.dataset.listenerSet = 'true';
    }
    
    updateCart();
}

// =====================================================================
// MISE À JOUR DU PANIER
// =====================================================================
function updateCart() {
    const cartItems = document.getElementById('cart-content');
    const totalElement = document.getElementById('cart-total');

    if (!state.selectedStrip || !state.length) {
        cartItems.innerHTML = '<div class="empty-message">Sélectionnez un ruban pour commencer</div>';
        totalElement.textContent = '0.00€';
        return;
    }

    let totalPrice = 0;
    let html = '';

    // Ruban LED
    const stripPrice = calculateStripPrice();
    const stripDetails = [];
    if (state.selectedStrip.type) stripDetails.push(state.selectedStrip.type);
    if (state.selectedStrip.leds_per_meter) stripDetails.push(`${state.selectedStrip.leds_per_meter} LED/m`);
    if (state.selectedStrip.voltage) stripDetails.push(`${state.selectedStrip.voltage}V`);
    if (state.selectedStrip.ip_rating) stripDetails.push(state.selectedStrip.ip_rating);
    
    // Image du ruban (vraie ou placeholder)
    let stripImageHtml = '';
    if (state.selectedStrip.image_url) {
        stripImageHtml = `<div class="cart-item-image" style="background-image: url('${assetUrl(state.selectedStrip.image_url)}');"></div>`;
    } else {
        const gradientClass = getStripGradientClass(state.selectedStrip);
        stripImageHtml = `<div class="cart-item-image ${gradientClass}"><span class="cart-item-icon">💡</span></div>`;
    }
    
    html += `
        <div class="cart-item">
            <span class="cart-item-badge badge-strip">Ruban LED</span>
            ${stripImageHtml}
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHTML(state.selectedStrip.name)}</div>
                <div class="cart-item-detail">${stripDetails.map(d => escapeHTML(d)).join(' • ')}</div>
                <div class="cart-item-meta">Longueur : ${state.length}m</div>
            </div>
            <div class="cart-item-price">${state.selectedStrip.id_product ? `<a href="/index.php?id_product=${state.selectedStrip.id_product}&controller=product" target="_blank">${safeNumber(stripPrice)}€</a>` : `${safeNumber(stripPrice)}€`}</div>
        </div>
    `;
    totalPrice += stripPrice;

    // Température de couleur (si sélectionnée)
    if (state.selectedColorTemp) {
        const tempBg = getTempColor(state.selectedColorTemp.kelvin);
        html += `
            <div class="cart-item cart-item-option">
                <span class="cart-item-badge badge-option">Option</span>
                ${createPlaceholderImage('temp', { isCartItem: true, customBg: tempBg })}
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(state.selectedColorTemp.label)}</div>
                    <div class="cart-item-meta">${state.selectedColorTemp.kelvin}K</div>
                </div>
                <div class="cart-item-price">Inclus</div>
            </div>
        `;
    }

    // Alimentation
    if (state.selectedSupply) {
        const supplyDetails = [];
        if (state.selectedSupply.voltage) supplyDetails.push(`${state.selectedSupply.voltage}V`);
        if (state.selectedSupply.max_power) supplyDetails.push(`${state.selectedSupply.max_power}W max`);
        if (state.selectedSupply.form_factor) supplyDetails.push(state.selectedSupply.form_factor);
        
        // Image alimentation
        let supplyImageHtml = '';
        if (state.selectedSupply.image_url) {
            supplyImageHtml = `<div class="cart-item-image" style="background-image: url('${assetUrl(state.selectedSupply.image_url)}');"></div>`;
        } else {
            supplyImageHtml = createPlaceholderImage('supply', { isCartItem: true });
        }
        
        html += `
            <div class="cart-item">
                <span class="cart-item-badge badge-supply">Alimentation</span>
                ${supplyImageHtml}
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(state.selectedSupply.name)}</div>
                    ${supplyDetails.length > 0 ? `<div class="cart-item-detail">${supplyDetails.map(d => escapeHTML(d)).join(' • ')}</div>` : ''}
                </div>
                <div class="cart-item-price">${state.selectedSupply.id_product ? `<a href="/index.php?id_product=${state.selectedSupply.id_product}&controller=product" target="_blank">${safeNumber(state.selectedSupply.price)}€</a>` : `${safeNumber(state.selectedSupply.price)}€`}</div>
            </div>
        `;
        totalPrice += state.selectedSupply.price;
    }

    // Câbles (optionnel)
    if (state.selectedCable && state.cableLength > 0) {
        const cableTotal = state.selectedCable.price_per_meter * state.cableLength;
        
        // Image câble
        let cableImageHtml = '';
        if (state.selectedCable.image_url) {
            cableImageHtml = `<div class="cart-item-image" style="background-image: url('${assetUrl(state.selectedCable.image_url)}');"></div>`;
        } else {
            cableImageHtml = createPlaceholderImage('cable', { isCartItem: true });
        }
        
        html += `
            <div class="cart-item">
                <span class="cart-item-badge badge-cable">Câble</span>
                ${cableImageHtml}
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(state.selectedCable.name)}</div>
                    <div class="cart-item-detail">Section ${escapeHTML(state.selectedCable.section)}mm²</div>
                    <div class="cart-item-meta">${state.cableLength}m × ${safeNumber(state.selectedCable.price_per_meter)}€/m</div>
                </div>
                <div class="cart-item-price">${state.selectedCable.id_product ? `<a href="/index.php?id_product=${state.selectedCable.id_product}&controller=product" target="_blank">${safeNumber(cableTotal)}€</a>` : `${safeNumber(cableTotal)}€`}</div>
            </div>
        `;
        totalPrice += cableTotal;
    }

    // Contrôleur
    if (state.selectedController) {
        const controllerDetails = [];
        if (state.selectedController.type) controllerDetails.push(state.selectedController.type);
        if (state.selectedController.max_pixels) controllerDetails.push(`${state.selectedController.max_pixels} pixels max`);
        
        // Image contrôleur
        let controllerImageHtml = '';
        if (state.selectedController.image_url) {
            controllerImageHtml = `<div class="cart-item-image" style="background-image: url('${assetUrl(state.selectedController.image_url)}');"></div>`;
        } else {
            controllerImageHtml = createPlaceholderImage('controller', { isCartItem: true });
        }
        
        html += `
            <div class="cart-item">
                <span class="cart-item-badge badge-controller">Contrôleur</span>
                ${controllerImageHtml}
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(state.selectedController.name)}</div>
                    <div class="cart-item-detail">${controllerDetails.map(d => escapeHTML(d)).join(' • ')}</div>
                </div>
                <div class="cart-item-price">${state.selectedController.id_product ? `<a href="/index.php?id_product=${state.selectedController.id_product}&controller=product" target="_blank">${safeNumber(state.selectedController.price)}€</a>` : `${safeNumber(state.selectedController.price)}€`}</div>
            </div>
        `;
        totalPrice += state.selectedController.price;
    }

    // Télécommande
    if (state.selectedRemote) {
        const remoteDetails = [];
        if (state.selectedRemote.type) remoteDetails.push(state.selectedRemote.type);
        if (state.selectedRemote.control_type) remoteDetails.push(state.selectedRemote.control_type);
        
        // Image télécommande
        let remoteImageHtml = '';
        if (state.selectedRemote.image_url) {
            remoteImageHtml = `<div class="cart-item-image" style="background-image: url('${assetUrl(state.selectedRemote.image_url)}');"></div>`;
        } else {
            remoteImageHtml = createPlaceholderImage('remote', { isCartItem: true });
        }
        
        html += `
            <div class="cart-item">
                <span class="cart-item-badge badge-remote">Télécommande</span>
                ${remoteImageHtml}
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(state.selectedRemote.name)}</div>
                    ${remoteDetails.length > 0 ? `<div class="cart-item-detail">${remoteDetails.map(d => escapeHTML(d)).join(' • ')}</div>` : ''}
                </div>
                <div class="cart-item-price">${state.selectedRemote.id_product ? `<a href="/index.php?id_product=${state.selectedRemote.id_product}&controller=product" target="_blank">${safeNumber(state.selectedRemote.price)}€</a>` : `${safeNumber(state.selectedRemote.price)}€`}</div>
            </div>
        `;
        totalPrice += state.selectedRemote.price;
    }

    // Câble d'extension facultatif
    if (state.selectedOptionalCable && state.optionalCableLength > 0) {
        const optionalCableTotal = state.selectedOptionalCable.price_per_meter * state.optionalCableLength;
        
        // Image câble extension
        let optionalCableImageHtml = '';
        if (state.selectedOptionalCable.image_url) {
            optionalCableImageHtml = `<div class="cart-item-image" style="background-image: url('${assetUrl(state.selectedOptionalCable.image_url)}');"></div>`;
        } else {
            optionalCableImageHtml = createPlaceholderImage('cable', { isCartItem: true });
        }
        
        html += `
            <div class="cart-item">
                <span class="cart-item-badge badge-cable">Câble Extension</span>
                ${optionalCableImageHtml}
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(state.selectedOptionalCable.name)}</div>
                    <div class="cart-item-detail">Section ${escapeHTML(state.selectedOptionalCable.section)}mm² • ${state.selectedOptionalCable.wire_count} fils</div>
                    <div class="cart-item-meta">${state.optionalCableLength}m × ${safeNumber(state.selectedOptionalCable.price_per_meter)}€/m</div>
                </div>
                <div class="cart-item-price">${state.selectedOptionalCable.id_product ? `<a href="/index.php?id_product=${state.selectedOptionalCable.id_product}&controller=product" target="_blank">${safeNumber(optionalCableTotal)}€</a>` : `${safeNumber(optionalCableTotal)}€`}</div>
            </div>
        `;
        totalPrice += optionalCableTotal;
    }

    cartItems.innerHTML = html;
    totalElement.textContent = totalPrice.toFixed(2) + '€';
    
    // Mettre à jour le compteur d'articles
    updateCartCount();
}

/**
 * Met à jour le compteur d'articles dans le panier
 */
function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (!cartCountElement) return;
    
    let count = 0;
    
    // Compter les articles sélectionnés
    if (state.selectedStrip) count++;
    if (state.selectedSupply) count++;
    if (state.selectedCable) count++;
    if (state.selectedController) count++;
    if (state.selectedRemote) count++;
    if (state.selectedOptionalCable && state.optionalCableLength > 0) count++;
    
    const articleText = count > 1 ? 'articles' : 'article';
    cartCountElement.textContent = `${count} ${articleText}`;
}

function calculateStripPrice() {
    if (state.selectedStrip.price_unit === 'meter') {
        return state.selectedStrip.price * state.length;
    } else {
        const rollsNeeded = Math.ceil(state.length / 5);
        return state.selectedStrip.price * rollsNeeded;
    }
}

function showColorTempOptions(options) {
    const container = document.getElementById('color-temp-options');
    container.innerHTML = '';

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'color-temp-btn';
        btn.textContent = `${option.label} (${option.kelvin}K)`;
        btn.onclick = (e) => selectColorTemp(option, e);
        container.appendChild(btn);
    });
    
    // NE PAS afficher ici, c'est géré dans selectStrip()
}

function selectColorTemp(option, event) {
    state.selectedColorTemp = option;
    
    // Marquer l'étape 2 comme complétée
    if (!state.completedSteps.includes(2)) {
        state.completedSteps.push(2);
    }

    document.querySelectorAll('.color-temp-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    const clickedBtn = event.target;
    if (clickedBtn) {
        clickedBtn.classList.add('selected');
    }
    
    // Passer à l'étape longueur après sélection température
    updateStepper(3);
    document.getElementById('step-length').classList.remove('hidden');
    updatePowerFeedRecommendation(state.length || 1);
    updateCart();
    // Valider immédiatement l'étape longueur (valeur par défaut déjà définie)
    autoCompleteLengthStep();
}

// ============================================================================
// RECOMMANDATION DE RÉALIMENTATION
// ============================================================================
function updatePowerFeedRecommendation(length) {
    const recommendationDiv = document.getElementById('power-feed-recommendation');
    const warningDiv = document.getElementById('power-feed-warning');
    
    // Toujours afficher la recommandation (même pour 1-5m)
    if (length >= 1) {
        // Calculer le nombre de points d'alimentation (tous les 5m)
        const feedPoints = Math.ceil(length / 5);
        const positions = [];
        
        for (let i = 0; i < feedPoints; i++) {
            positions.push(i * 5);
        }
        
        // Mettre à jour le récapitulatif ruban violet
        updateStripSummary(length, feedPoints);
        
        // Afficher la recommandation
        recommendationDiv.style.display = 'block';
        document.getElementById('power-feed-text').textContent = 
            `Réalimentation tous les 5m (${feedPoints} point${feedPoints > 1 ? 's' : ''} d'alimentation)`;
        
        // Générer les boutons de position
        const pointsContainer = document.getElementById('power-feed-points');
        
        if (feedPoints === 1) {
            // 1 seul point : afficher "Début"
            pointsContainer.innerHTML = '<span class="power-point">Point 1: Début</span>';
        } else if (feedPoints === 2) {
            // 2 points : afficher "Début" et "Fin"
            pointsContainer.innerHTML = `
                <span class="power-point">Point 1: Début</span>
                <span class="power-point">Point 2: Fin</span>
            `;
        } else {
            // 3 points ou plus : afficher les métrages
            pointsContainer.innerHTML = positions.map((pos, idx) => 
                `<span class="power-point">Point ${idx + 1}: ${pos}m</span>`
            ).join('');
        }
        
        // Afficher la note importante
        warningDiv.style.display = 'block';
        if (feedPoints === 1) {
            // Pour 1 point uniquement
            document.getElementById('power-feed-warning-text').innerHTML = 
                `Avec ${length}m de ruban, vous aurez besoin d'<strong>un seul point d'alimentation au début</strong> du ruban LED.`;
        } else {
            // Pour 2 points ou plus
            document.getElementById('power-feed-warning-text').innerHTML = 
                `Avec ${length}m de ruban, vous aurez besoin de ${feedPoints} points d'alimentation sur le ruban LED (${positions.join('m, ')}m), mais d'<strong>une seule alimentation</strong>. Le départ devra être divisé en ${feedPoints} via des connecteurs adaptés (Wago ou équivalent) pour alimenter le ruban aux positions indiquées et éviter les pertes de puissance lumineuse.`;
        }
    } else {
        // Masquer les recommandations si aucune longueur
        recommendationDiv.style.display = 'none';
        warningDiv.style.display = 'none';
    }
}

/**
 * Met à jour le récapitulatif du ruban dans la div violette
 */
function updateStripSummary(length, feedPoints) {
    const stripSummary = document.getElementById('strip-summary');
    if (!stripSummary || !state.selectedStrip) return;
    
    // Afficher la section
    stripSummary.classList.remove('hidden');
    
    // Mettre à jour le nom et la longueur
    document.getElementById('strip-summary-name').textContent = state.selectedStrip.name || 'Ruban LED';
    document.getElementById('strip-summary-length').textContent = `${length}m`;
    
    // Mettre à jour le texte du nombre de points
    document.getElementById('power-points-count').textContent = feedPoints;
    const pointsTextSpan = rootContainer.querySelector('.power-points-text');
    pointsTextSpan.textContent = feedPoints > 1 ? 'points d\'alimentation' : 'point d\'alimentation';
    
    // Stocker feedPoints dans le state pour le schéma de câblage
    state.feedPoints = feedPoints;
    
    // Créer les boutons de points d'alimentation
    const container = document.getElementById('power-points-buttons');
    container.innerHTML = '';
    
    if (feedPoints === 1) {
        const btn = document.createElement('button');
        btn.className = 'power-point-btn';
        btn.textContent = 'Point 1: 0m';
        container.appendChild(btn);
    } else if (feedPoints === 2) {
        const btn1 = document.createElement('button');
        btn1.className = 'power-point-btn';
        btn1.textContent = 'Point 1: 0m';
        container.appendChild(btn1);
        
        const btn2 = document.createElement('button');
        btn2.className = 'power-point-btn';
        btn2.textContent = `Point 2: ${(feedPoints - 1) * 5}m`;
        container.appendChild(btn2);
    } else {
        for (let i = 0; i < feedPoints; i++) {
            const btn = document.createElement('button');
            btn.className = 'power-point-btn';
            btn.textContent = `Point ${i + 1}: ${i * 5}m`;
            container.appendChild(btn);
        }
    }
    
    // Mettre à jour le schéma de câblage
    updateWiringDiagram();
    
    // Mettre à jour le récapitulatif
    updateConfigSummary();
}

/**
 * Met à jour le schéma de câblage final avec les produits sélectionnés
 */
function updateWiringDiagram() {
    const diagram = document.getElementById('wiring-diagram');
    if (!diagram) return;
    
    // Afficher le schéma si au moins le ruban est sélectionné
    if (state.selectedStrip) {
        diagram.classList.remove('hidden');
        
        // Mettre à jour les spécifications de chaque produit
        if (state.selectedSupply) {
            const supplySpecs = document.getElementById('diagram-supply-specs');
            if (supplySpecs) {
                supplySpecs.textContent = `${state.selectedSupply.voltage}V - ${state.selectedSupply.power}W`;
            }
        }
        
        if (state.selectedController) {
            const controllerSpecs = document.getElementById('diagram-controller-specs');
            if (controllerSpecs) {
                controllerSpecs.textContent = state.selectedController.reference || 'Contrôleur';
            }
        }
        
        if (state.selectedRemote) {
            const remoteSpecs = document.getElementById('diagram-remote-specs');
            if (remoteSpecs) {
                remoteSpecs.textContent = state.selectedRemote.reference || state.selectedRemote.name || 'Télécommande';
            }
        }
        
        if (state.selectedStrip) {
            const stripSpecs = document.getElementById('diagram-strip-specs');
            if (stripSpecs) {
                stripSpecs.textContent = state.selectedStrip.ref || state.selectedStrip.name;
            }
            
            // Mettre à jour le câblage contrôleur -> ruban selon le nombre de fils
            const wiresElement = document.getElementById('controller-strip-wires');
            if (wiresElement && state.selectedStrip.wire_count) {
                // Supprimer les anciennes classes
                wiresElement.classList.remove('wires-3', 'wires-4');
                // Ajouter la classe correspondante
                wiresElement.classList.add(`wires-${state.selectedStrip.wire_count}`);
            }
            
            // Générer les connexions d'alimentation avec labels
            const powerConnectionsContainer = document.getElementById('strip-power-connections');
            if (powerConnectionsContainer && state.feedPoints && state.feedPoints > 1) {
                powerConnectionsContainer.innerHTML = '';
                
                // Créer les connexions pour les points 2 et suivants (le point 1 est l'alimentation d'origine)
                for (let i = 1; i < state.feedPoints; i++) {
                    const distance = i * 5; // Distance en mètres
                    const connectionDiv = document.createElement('div');
                    connectionDiv.className = 'power-connection';
                    connectionDiv.innerHTML = `
                        <div class="power-connection-label">
                            Repiquage à ${distance}m du ruban
                        </div>
                        <div class="power-connection-wires">
                            <div class="power-connection-wire-pair"></div>
                        </div>
                    `;
                    powerConnectionsContainer.appendChild(connectionDiv);
                }
            } else if (powerConnectionsContainer) {
                powerConnectionsContainer.innerHTML = '';
            }
        }
    }
}

/**
 * Met à jour le récapitulatif de la configuration
 */
function updateConfigSummary() {
    const summarySection = document.getElementById('config-summary-section');
    if (!summarySection) return;
    
    // Afficher la section dès que le ruban est sélectionné
    if (state.selectedStrip) {
        summarySection.classList.remove('hidden');
        
        // Ruban LED
        const stripName = document.getElementById('summary-strip-name');
        if (stripName) {
            stripName.textContent = state.selectedStrip.ref || state.selectedStrip.name || '-';
        }
        
        // Température de couleur
        const stripTemp = document.getElementById('summary-strip-temp');
        if (stripTemp) {
            if (state.selectedColorTemp) {
                stripTemp.textContent = `${state.selectedColorTemp.kelvin}K - ${state.selectedColorTemp.label}`;
            } else if (state.selectedStrip.color_temperature && state.selectedStrip.color_description) {
                stripTemp.textContent = `±${state.selectedStrip.color_temperature}K - ${state.selectedStrip.color_description}`;
            } else {
                stripTemp.textContent = '-';
            }
        }
        
        // Longueur du ruban
        const stripLength = document.getElementById('summary-strip-length');
        if (stripLength) {
            stripLength.textContent = state.length ? `${state.length}m` : '-';
        }
        
        // Puissance du ruban
        const stripPower = document.getElementById('summary-strip-power');
        if (stripPower) {
            stripPower.textContent = state.selectedStrip.power_per_meter ? `${state.selectedStrip.power_per_meter}W/m` : '-';
        }
        
        // Points d'alimentation
        const feedPoints = document.getElementById('summary-feed-points');
        if (feedPoints) {
            feedPoints.textContent = state.feedPoints || '-';
        }
        
        // Puissance nécessaire (calculée)
        const totalPower = document.getElementById('summary-total-power');
        if (totalPower) {
            if (state.selectedStrip && state.length) {
                const calculatedPower = (state.selectedStrip.power_per_meter * state.length).toFixed(1);
                totalPower.textContent = `${calculatedPower}W`;
            } else {
                totalPower.textContent = '-';
            }
        }
        
        // Alimentation
        const powerSupply = document.getElementById('summary-power-supply');
        if (powerSupply) {
            powerSupply.textContent = state.selectedSupply ? (state.selectedSupply.reference || state.selectedSupply.name) : '-';
        }
        
        // Contrôleur (facultatif)
        const controllerRow = document.getElementById('summary-controller-row');
        const controller = document.getElementById('summary-controller');
        if (state.selectedController) {
            controllerRow?.classList.remove('hidden');
            if (controller) {
                controller.textContent = state.selectedController.reference || state.selectedController.name || '-';
            }
        } else {
            controllerRow?.classList.add('hidden');
        }
        
        // Produits de pilotage (afficher seulement si télécommande)
        const controlProductsRow = document.getElementById('summary-control-products-row');
        if (state.selectedRemote) {
            controlProductsRow?.classList.remove('hidden');
        } else {
            controlProductsRow?.classList.add('hidden');
        }
        
        // Télécommande (facultatif)
        const remoteRow = document.getElementById('summary-remote-row');
        const remote = document.getElementById('summary-remote');
        if (state.selectedRemote) {
            remoteRow?.classList.remove('hidden');
            if (remote) {
                remote.textContent = state.selectedRemote.reference || state.selectedRemote.name;
            }
        } else {
            remoteRow?.classList.add('hidden');
        }
        
    } else {
        summarySection.classList.add('hidden');
    }
}

// =====================================================
// MISE À JOUR DU REMPLISSAGE DU SLIDER
// =====================================================
function updateSliderFill(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const rawValue = parseFloat(slider.value);
    const value = isNaN(rawValue) ? min : rawValue;
    const clamped = Math.min(max, Math.max(value, min));
    
    // Calculer le pourcentage
    const percentage = ((clamped - min) / (max - min)) * 100;
    
    // Appliquer un dégradé : noir jusqu'au curseur, gris après
    slider.style.background = `linear-gradient(to right, #000000 0%, #000000 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`;
}

// ========================================================
// GESTION DU STEPPER
//=========================================================
function updateStepper(currentStep) {
    // Récupérer toutes les étapes visibles
    const allSteps = document.querySelectorAll('.stepper-step');
    const visibleSteps = Array.from(allSteps).filter(step => step.style.display !== 'none');
    
    // Renuméroter les bulles visibles
    visibleSteps.forEach((step, index) => {
        const circle = step.querySelector('.stepper-circle');
        circle.textContent = index + 1;
    });
    
    // Retirer toutes les classes de statut
    allSteps.forEach(step => {
        step.classList.remove('active', 'completed', 'incomplete');
    });
    
    // Marquer les étapes selon leur statut réel
    allSteps.forEach(step => {
        const stepNumber = parseInt(step.dataset.step);
        
        // Étape active (en cours)
        if (stepNumber === currentStep) {
            step.classList.add('active');
            if (state.completedSteps.includes(stepNumber)) {
                step.classList.add('completed');
            }
        }
        // Étape réellement complétée (dans completedSteps)
        else if (state.completedSteps.includes(stepNumber)) {
            step.classList.add('completed');
        }
        // Étape incomplète (pas encore visitée ou pas validée)
        else {
            step.classList.add('incomplete');
        }
    });
}

// Valide automatiquement l'étape longueur si une longueur est déjà définie
function autoCompleteLengthStep() {
    if (!state.selectedStrip || !state.length) return;
    if (!state.completedSteps.includes(3)) {
        state.completedSteps.push(3);
    }
    // Reste sur l'étape longueur pour laisser l'utilisateur ajuster
    updateStepper(3);
}

/**
 * Rafraîchit l'affichage du stepper sans changer l'étape active.
 * À utiliser lors d'une désélection pour repasser l'étape en orange.
 */
function refreshStepper() {
    const allSteps = document.querySelectorAll('.stepper-step');

    allSteps.forEach(step => {
        const stepNumber = parseInt(step.dataset.step);
        const isActive = step.classList.contains('active');

        // Ne pas toucher à l'étape active, sinon conserver l'état réel
        step.classList.remove('completed', 'incomplete');

        if (isActive) return;

        if (state.completedSteps.includes(stepNumber)) {
            step.classList.add('completed');
        } else {
            step.classList.add('incomplete');
        }
    });
}

// ===============================================================
// STICKY CART (FALLBACK JS)
// ===============================================================
function initStickyCart() {
    const cart = rootContainer.querySelector('.cart-sticky');
    const cartColumn = rootContainer.querySelector('.cart-column');
    
    if (!cart || !cartColumn) return;
    
    const header = rootContainer.querySelector('.header');
    const stepper = rootContainer.querySelector('.stepper-container');
    const headerHeight = header ? header.offsetHeight : 0;
    const stepperHeight = stepper ? stepper.offsetHeight : 0;
    const topOffset = headerHeight + stepperHeight + 20;
    
    let isSticky = false;
    const originalTop = cart.offsetTop;
    
    function handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const cartColumnRect = cartColumn.getBoundingClientRect();
        const shouldBeSticky = scrollTop > (originalTop - topOffset);
        
        if (shouldBeSticky && !isSticky) {
            cart.style.position = 'fixed';
            cart.style.top = topOffset + 'px';
            cart.style.width = cartColumnRect.width + 'px';
            isSticky = true;
        } else if (!shouldBeSticky && isSticky) {
            cart.style.position = 'sticky';
            cart.style.top = '20px';
            cart.style.width = '';
            isSticky = false;
        }
        
        // Mettre à jour la largeur si sticky
        if (isSticky) {
            const newWidth = cartColumn.getBoundingClientRect().width;
            cart.style.width = newWidth + 'px';
        }
    }
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    handleScroll(); // Initial check
}

// ===============================================================
// PANIER MOBILE (TOGGLE)
// ===============================================================
function initMobileCart() {
    const cartColumn = rootContainer.querySelector('.cart-column');
    const cartSticky = rootContainer.querySelector('.cart-sticky');
    
    if (!cartColumn || !cartSticky) return;
    
    // Vérifier si on est sur mobile
    function isMobile() {
        return window.innerWidth <= 1024;
    }
    
    // Toggle du panier sur mobile
    function toggleCart() {
        if (isMobile()) {
            cartColumn.classList.toggle('open');
        }
    }
    
    // Click sur la barre de drag (pseudo-élément before)
    cartSticky.addEventListener('click', (e) => {
        if (isMobile()) {
            // Si le click est dans les 40px du haut (la zone du drag handle)
            const rect = cartSticky.getBoundingClientRect();
            if (e.clientY - rect.top < 40) {
                toggleCart();
            }
        }
    });
    
    // Fermer le panier quand on scroll vers le haut sur mobile
    let lastScrollTop = 0;
    window.addEventListener('scroll', () => {
        if (isMobile()) {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > lastScrollTop && cartColumn.classList.contains('open')) {
                // Scroll vers le bas : fermer le panier
                cartColumn.classList.remove('open');
            }
            lastScrollTop = scrollTop;
        }
    });
    
    // Réinitialiser l'état lors du resize
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            cartColumn.classList.remove('open');
        }
    });
}

// ===============================================================
// FONCTION D'INITIALISATION PUBLIQUE
// ===============================================================
function init() {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialiser le container une fois le DOM chargé
        rootContainer = document.getElementById('byled-configurator');
        
        if (!rootContainer) {
            console.error('ByLED Configurator: Element #byled-configurator not found');
            return;
        }
        
        loadStrips();
        setupEventListeners();
        updateCart();
        initStickyCart();
        initMobileCart();
        createConfirmModal();
    });
}

// ===============================================================
// API PUBLIQUE - Un seul point d'entrée global
// ===============================================================
return {
    init: init
};

})();

// ===============================================================
// DÉMARRAGE DU CONFIGURATEUR
// ===============================================================
ByLEDConfigurator.init();
// Cache buster 1766393528
