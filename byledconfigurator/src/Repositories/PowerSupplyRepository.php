<?php

require_once __DIR__ . '/../Models/PowerSupply.php';

/**
 * Repository pour gérer l'accès aux données des alimentations LED
 * Charge les données depuis data/power_supplies.json
 */
class PowerSupplyRepository
{
    /**
     * Chemin vers le fichier JSON des alimentations
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
        $this->dataFile = $config['data_paths']['power_supplies'];
    }

    /**
     * Récupère toutes les alimentations disponibles
     * @return PowerSupply[] Tableau d'objets PowerSupply
     */
    public function findAll(): array
    {
        // 1. Lire le fichier JSON
        $jsonContent = file_get_contents($this->dataFile);

        // 2. Décoder le JSON en tableau PHP
        $data = json_decode($jsonContent, true);

        // 3. Transformer chaque tableau en objet PowerSupply
        $powerSupplies = [];
        foreach ($data as $item) {
            $powerSupplies[] = new PowerSupply($item);
        }

        // 4. Retourner le tableau d'objets
        return $powerSupplies;
    }

    /**
     * Trouve une alimentation par son ID
     * @param int $id ID de l'alimentation recherchée
     * @return PowerSupply|null L'objet PowerSupply ou null si non trouvé
     */
    public function findById(int $id): ?PowerSupply
    {
        // 1. Récupérer toutes les alimentations
        $allSupplies = $this->findAll();

        // 2. Parcourir pour trouver celle avec le bon ID
        foreach ($allSupplies as $supply) {
            if ($supply->id === $id) {
                return $supply; // Trouvé !
            }
        }

        // 3. Si on arrive ici, c'est qu'on n'a rien trouvé
        return null;
    }

    /**
     * Trouve toutes les alimentations d'un voltage donné
     * @param int $voltage Voltage recherché (12 ou 24)
     * @return PowerSupply[] Tableau d'objets PowerSupply correspondants
     */
    public function findByVoltage(int $voltage): array
    {
        // 1. Récupérer toutes les alimentations
        $allSupplies = $this->findAll();

        // 2. Filtrer celles qui correspondent au voltage
        $result = [];
        foreach ($allSupplies as $supply) {
            if ($supply->voltage === $voltage) {
                $result[] = $supply;
            }
        }

        // 3. Retourner les alimentations filtrées
        return $result;
    }
}
