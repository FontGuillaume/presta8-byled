<?php

/**
 * Classe représentant un câble d'alimentation LED
 * Correspond aux données de data/cables.json
 */
class Cable
{
    //=== IDENTIFIANTS ===
    public $id;                       // ID unique du câble
    public $name;                  // Nom commercial
    public $reference;             // Référence produit

    //=== CARACTERISTIQUES TECHNIQUES ===
    public $wireCount;                // Nombre de fils (2, 3, 4, 5)
    public $section;                // Section en mm²
    public $usage;                 // Usage : 'power' (alim→contrôleur) ou 'extension' (contrôleur→ruban)

    //=== PRIX ===
    public $pricePerMeter;

    //=== IMAGE ===
    public $imageUrl;

    /**
     * Constructeur : transforme les données JSON en objet Cable
     * @param array $data Tableau associatif venant du JSON
     */
    public function __construct(array $data)
    {
        $this->id = $data['id'];
        $this->name = $data['name'];
        $this->reference = $data['reference'];
        $this->wireCount = $data['wire_count'];
        $this->section = $data['section'];
        $this->usage = $data['usage'] ?? 'power';
        $this->pricePerMeter = $data['price_per_meter'];
        $this->imageUrl = $data['image_url'] ?? null;
    }

    /**
     * Calcule le prix pour une longueur donnée
     * @param int $length Longueur en mètres
     * @return float Prix en euros
     */
    public function calculatePrice(int $length): float
    {
        return $length * $this->pricePerMeter;
    }
}