<?php

require_once __DIR__ . '/../Models/Remote.php';

/**
 * Repository pour gérer l'accès aux données des télécommandes/contrôleurs LED
 * Charge les données depuis data/remotes.json
 */
class RemoteRepository
{
    /**
     * Chemin vers le fichier JSON des télécommandes
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
        $this->dataFile = $config['data_paths']['remotes'];
    }

    /**
     * Récupère toutes les télécommandes disponibles
     * @return Remote[] Tableau d'objets Remote
     */
    public function findAll(): array
    {
        // 1. Lire le fichier JSON
        $jsonContent = file_get_contents($this->dataFile);

        // 2. Décoder le JSON en tableau PHP
        $data = json_decode($jsonContent, true);

        // 3. Transformer chaque tableau en objet Remote
        $remotes = [];
        foreach ($data as $item) {
            $remotes[] = new Remote($item);
        }

        // 4. Retourner le tableau d'objets
        return $remotes;
    }

    /**
     * Trouve une télécommande par son ID
     * @param int $id ID de la télécommande recherchée
     * @return Remote|null L'objet Remote ou null si non trouvé
     */
    public function findById(int $id): ?Remote
    {
        // 1. Récupérer toutes les télécommandes
        $allRemotes = $this->findAll();

        // 2. Parcourir pour trouver celle avec le bon ID
        foreach ($allRemotes as $remote) {
            if ($remote->id === $id) {
                return $remote; // Trouvé !
            }
        }

        // 3. Si on arrive ici, c'est qu'on n'a rien trouvé
        return null;
    }

    /**
     * Trouve toutes les télécommandes d'un voltage donné
     * @param int $voltage Voltage recherché (12 ou 24)
     * @return Remote[] Tableau d'objets Remote correspondants
     */
    public function findByVoltage(int $voltage): array
    {
        // 1. Récupérer toutes les télécommandes
        $allRemotes = $this->findAll();

        // 2. Filtrer celles qui correspondent au voltage
        $result = [];
        foreach ($allRemotes as $remote) {
            if ($remote->voltage === $voltage) {
                $result[] = $remote;
            }
        }

        //3. Retourner les télécommandes filtrées
        return $result;
    }

    /**
     * Trouve toutes les télécommandes d'un type donné
     * @param string $type Type recherché (RGB....)
     * @return Remote[] Tableau d'objets Remote correspondants
     */
    public function findByType(string $type): array
    {
        // 1. Récupérer toutes les télécommandes 
        $allRemotes = $this->findAll();

        // 2. Filtrer celles qui correspondent au type
        $result = [];
        foreach ($allRemotes as $remote) {
            if ($remote->type === $type) {
                $result[] = $remote;
            }
        }

        // 3. Retourner les télécommandes filtrées
        return $result;
    }
}