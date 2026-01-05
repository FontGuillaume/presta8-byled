<?php
 /**
  * Classe représentant une alimentation LED
  * Correspond aux données de data/power_supplies.json
  */
 class PowerSupply
 {
    //=== IDENTIFIANTS ===
    public $id;                  // ID unique de l'alimentation
    public $name;             // Nom commercial (ex: "Alimentation LED 12V 60W MeanWell")
    public $reference;        // Référence produit (ex: "PSU-12V-60W-MW")
    public $imageUrl;        // URL de l'image du produit (optionnel)
    public $type;            // Type/Catégorie (ex: "compact", "meanwell", "transformateur")

    //=== CARACTERISTIQUE TECHNIQUES ===
    public $voltage;             // Tension de sortie : 12V ou 24V
    public $maxPower;            // Puissance maximum en Watts (ex: 60W, 100W...)
    public $wiring;          // Type de câblage : "pre-cable" ou "cablage-requis"
    public $info;            // Information complémentaire pour tooltip

    //=== PRIX ===
    public $price;             // Prix de l'alimentation

    /**
     * Constructeur : transforme les données JSON en objet PowerSupply
     * @param array $data Tableau associatif venant du JSON
     */
    public function __construct(array $data)
    {
        $this->id = $data['id'];
        $this->name = $data['name'];
        $this->reference = $data['reference'];
        $this->imageUrl = $data['image_url'] ?? null;
        $this->type = $data['type'] ?? null;
        $this->voltage = $data['voltage'];
        $this->maxPower = $data['max_power'];
        $this->wiring = $data['wiring'] ?? 'pre-cable';
        $this->info = $data['info'] ?? null;
        $this->price = $data['price'];
    }

    /**
     * Vérifie si cette alimentation peut supporter la puissance demandée
     * @param float $requiredPower Puissance nécessaire en Watts
     * @return bool true si compatible
     */
    public function canHandle(float $requiredPower): bool
    {
        return $this->maxPower >= $requiredPower;
    }
 }