<?php

require_once __DIR__ . '/../Models/LedStrip.php';

/**
 * Repository pour gérer l'accès aux données des rubans LED
 * Charge les données depuis data/led_strips.json
 */
class LedStripRepository
{
    /**
     * Chemin vers le fichier JSON des rubans LED
     */
    private $dataFile;

    /**
     * Constructeur : charge le chemin du fichier depuis la config
     */
    public function __construct()
    {
        // On charge la configuration
        $config = require __DIR__ . '/../../config/app.php';

        // On récupère le chemin du fichier JSON
        $this->dataFile = $config['data_paths']['led_strips'];
    }

    /**
     * Récupère tous les rubans LED disponibles
     * @return LedStrip[] Tableau d'objets LedStrip
     */
    public function findAll(): array
    {
        // 1. Lire le fichier JSON
        $jsonContent = file_get_contents($this->dataFile);

        // 2. Décoder le JSON en tableau PHP
        $data = json_decode($jsonContent, true);

        // 3. Transformer chaque tableau en objet LedStrip
        $ledStrips = [];
        foreach ($data as $item) {
            $ledStrips[] = new LedStrip($item);
        }

        // 4. Retourner le tableau d'objets
        return $ledStrips;
    }

    /**
     * Trouve un ruban LED par son ID
     * @param int $id ID du ruban recherché
     * @return LedStrip|null L'objet LedStrip ou null si non trouvé
     */
    public function findById(int $id): ?LedStrip
    {
        // 1. Récupérer tous les rubans
        $allStrips = $this->findAll();

        // 2. Parcourir pour trouver celui avec le bon ID
        foreach ($allStrips as $strip) {
            if ($strip->id === $id) {
                return $strip; // Trouvé !
            }
        }

        // 3. Si on arrive ici, c'est qu'on n'a rien trouvé 
        return null;
    }

    /**
     * Trouve tous les rubans LED d'un voltage donné
     * @param int $voltage Voltage recherché (12 ou 24)
     * @return LedStrip[] Tableau d'objets LedStrip correspondants
     */
    public function findByVoltage(int $voltage): array
    {
        // 1. Récupérer tous les rubans
        $allStrips = $this->findAll();

        // 2. Filtrer ceux qui correspondent au voltage
        $result = [];
        foreach ($allStrips as $strip) {
            if ($strip->voltage === $voltage) {
                $result[] = $strip;
            }
        }

        // 3. Retourner les rubans filtrés
        return $result;
    }
}