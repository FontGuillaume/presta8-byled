<?php

/**
 * Configuration du configurateur LED ByLED
 * Contient tous les paramètres globaux de l'application
 */

return [
    // ========================================
    // CALCULS DE PUISSANCE
    // ========================================
    
    /**
     * Marge de sécurité appliquée aux alimentations
     * 
     * Valeur : 0.20 (20%)
     * 
     * Explication :
     * Les alimentations ne doivent jamais fonctionner à 100% de leur capacité
     * pour éviter la surchauffe et prolonger leur durée de vie.
     * 
     * Exemple :
     * - Ruban 14.4W/m × 5m = 72W
     * - Avec marge : 72W × 1.20 = 86.4W
     * - Alimentation recommandée : ≥ 86.4W (on prendra 100W)
     * 
     * Utilisé dans : ConfiguratorService::calculateTotalPower()
     */
    'power_supply_margin' => 0.20,

    // ========================================
    // CHEMINS DES DONNÉES PRODUITS
    // ========================================
    
    /**
     * Chemins absolus vers les fichiers JSON contenant les données produits
     * 
     * __DIR__ : Chemin du dossier config/
     * /../data/ : Remonte d'un niveau puis entre dans data/
     * 
     * Utilisé dans : Tous les Repositories (LedStripRepository, etc.)
     */
    'data_paths' => [
        'led_strips'      => __DIR__ . '/../data/led_strips.json',
        'power_supplies'  => __DIR__ . '/../data/power_supplies.json',
        'remotes'         => __DIR__ . '/../data/remotes.json',
        'controllers'     => __DIR__ . '/../data/controllers.json',
        'cables'          => __DIR__ . '/../data/cables.json'
    ]
];