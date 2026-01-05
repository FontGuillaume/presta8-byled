<?php

require_once __DIR__ . '/../Models/Controller.php';

/**
 * Repository pour gérer l'accès aux données des contrôleurs LED
 * Charge les données depuis data/controllers.json
 */
class ControllerRepository
{
    /**
     * Chemin vers le fichier JSON des contrôleurs
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
        $this->dataFile = $config['data_paths']['controllers'];
    }

    /**
     * Récupère tous les contrôleurs disponibles
     * @return Controller[] Tableau d'objets Controller
     */
    public function findAll(): array
    {
        // 1. Lire le fichier JSON
        $jsonContent = file_get_contents($this->dataFile);

        // 2. Décoder le JSON en tableau PHP
        $data = json_decode($jsonContent, true);

        // 3. Transformer chaque tableau en objet Controller
        $controllers = [];
        foreach ($data as $item) {
            $controllers[] = new Controller($item);
        }

        // 4. Retourner le tableau d'objets
        return $controllers;
    }

    /**
     * Trouve un contrôleur par son ID
     * @param int $id ID du contrôleur recherché
     * @return Controller|null L'objet Controller ou null si non trouvé
     */
    public function findById(int $id): ?Controller
    {
        // 1. Récupérer tous les contrôleurs
        $allControllers = $this->findAll();

        // 2. Parcourir pour trouver celui avec le bon ID
        foreach ($allControllers as $controller) {
            if ($controller->id === $id) {
                return $controller; // Trouvé !
            }
        }

        // 3. Si on arrive ici, c'est qu'on n'a rien trouvé
        return null;
    }

    /**
     * Trouve tous les contrôleurs d'un voltage donné
     * @param int $voltage Voltage recherché (12 ou 24V)
     * @return Controller[] Tableau d'objets Controller correspondants
     */
    public function findByVoltage(int $voltage): array
    {
        // 1. Récupérer tous les contrôleurs
        $allControllers = $this->findAll();

        // 2. Filtrer ceux qui correspondent au voltage
        $result = [];
        foreach ($allControllers as $controller) {
            if ($controller->voltage === $voltage) {
                $result[] = $controller;
            }
        }

        // 3. Retourner les contrôleurs filtrés
        return $result;
    }

    /**
     * Trouve tous les contrôleurs d'un type donné
     * @param string $type Type recherché (RGB, RGBW, RGBCCT, CCT)
     * @return Controller[] Tableau d'objets Controller correspondants
     */
    public function findByType(string $type): array
    {
        // 1. Récupérer tous les contrôleurs
        $allControllers = $this->findAll();

        // 2. Filtrer ceux qui correspondent au type
        $result = [];
        foreach ($allControllers as $controller) {
            if ($controller->type === $type) {
                $result[] = $controller;
            }
        }

        // 3. Retourner les contrôleurs filtrés
        return $result;
    }
}