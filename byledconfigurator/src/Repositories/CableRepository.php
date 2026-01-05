<?php

require_once __DIR__ . '/../Models/Cable.php';

/**
 * Repository pour gérer l'accès aux données des câbles LED
 * Charge les données depuis data/cables.json
 */
class CableRepository
{
    /**
     * Chemin vers le fichier JSON des câbles
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
        $this->dataFile = $config['data_paths']['cables'];
    }

    /**
     * Récupère tous les cpables disponibles
     * @return Cable[] Tableau d'objets Cable
     */
    public function findAll(): array
    {
        // 1. Lire le fichier JSON
        $jsonContent = file_get_contents($this->dataFile);

        // 2. Décoder le JSON en tableau PHP
        $data = json_decode($jsonContent, true);

        // 3. Transformer chaque tableau en objet Cable
        $cables = [];
        foreach ($data as $item) {
            $cables[] = new Cable($item);
        }

        // 4. Retourner le tableau d'objets
        return $cables;
    }

    /**
     * Trouve un câble par son ID
     * @param int $id ID du câble recherché
     * @return Cable|null L'objet Cable ou null si non trouvé
     */
    public function findById(int $id): ?Cable
    {
        // 1. Récupérer tous les câbles
        $allCables = $this->findAll();

        // 2. Parcourir pour trouver celui avec le bon ID
        foreach ($allCables as $cable) {
            if ($cable->id === $id) {
                return $cable; // Trouvé !
            }
        }

        // 3. Si on arrive ici, c'est qu'on n'a rien trouvé
        return null;
    }
}