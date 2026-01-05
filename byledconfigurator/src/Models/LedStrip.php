<?php

/**
 * Classe représentant un ruban LED
 * Correspond aux données de data/led_strips.json
 */
class LedStrip
{
    //=== IDENTIFIANTS ===
    public $id;                   // ID unique du ruban 
    public $name;              // Nom commercial (ex: "Ruban LED RGB 12V - 60 LED/m)
    public $reference;         // Reference produit (ex: "RGB-12V-60)
    public  $imageUrl;         // URL de l'image du produit (optionnel)

    //=== CARACTERISTIQUES TECHNIQUES ===
    public $voltage;              // Tension 12V ou 24V
    public $powerPerMeter;      // Puissance consommée par mètre
    public $ledsPerMeter;         // Nombre de LEDs par mètre (physique)
    public $pixelsPerMeter;      // Nombre de pixels contrôlables par mètre
    public $chipType;          // Type de puce (WS2811, WS2815B, IC1935, etc.)
    public $type;              // Type: RGB, RGBW, RGBCCT, CCTn monochrome
    public $signalProtocol;    // Protocole signal: SPI_1WIRE (3 fils) ou SPI_2WIRE (4 fils)
    public $wireCount;            // Nombre de fils nécessaires (déduit de signalProtocol)
    public $colorTemperature; 
    public $colorOptions;       // Options de température de couleur

    //== PRIX ET VENTE ===
    public $price;              // Prix au mètre ou au rouleau selon priceUnit
    public $priceUnit;         // Mode de vente : "meter"ou "roll"

    //=== CONTRAINTES ===
    public $requiresController;  // true = nécessite une télécommande
    public $maxLengthPerRoll;     // Longueur maximum d'un rouleau (généralement 5m)

    /**
     * Constructeur : transforme les données JSON en objet LedStrip
     * @param array $data Tableau associatif venant du JSON
     */
    public function __construct(array $data)
    {
        $this->id = $data['id'];
        $this->name = $data['name'];
        $this->reference = $data['reference'];
        $this->imageUrl = $data['image_url'] ?? null;
        $this->voltage = $data['voltage'];
        $this->powerPerMeter = $data['power_per_meter'];
        $this->ledsPerMeter = $data['leds_per_meter'];
        $this->pixelsPerMeter = $data['pixels_per_meter'] ?? null;
        $this->chipType = $data['chip_type'];
        $this->type = $data['type'];
        $this->signalProtocol = $data['signal_protocol'] ?? 'SPI_1WIRE';
        // Déduire wire_count depuis signal_protocol si non fourni
        $this->wireCount = $data['wire_count'] ?? ($this->signalProtocol === 'SPI_2WIRE' ? 4 : 3);
        $this->colorTemperature = $data['color_temperature'] ?? null;
        $this->colorOptions = $data['color_options'] ?? [];
        $this->price = $data['price'];
        $this->priceUnit = $data['price_unit'];
        $this->requiresController = $data['requires_controller'];
        $this->maxLengthPerRoll = $data['max_length_per_roll'];
    }

    /**
     * Calcule la puissance totale nécessaire
     * Exemple : 5m x 14.4W/m = 72W
     * @param int $length Longeur en mètres
     * @return float Puissance totale en Watts
     */
    public function calculateTotalPower(int $length): float
    {
        return $length * $this->powerPerMeter;
    }

    /**
     * Calcule le prix selon le mode de vente
     * @param int $length Longeur en mètres
     * @return float Prix total
     */
    public function calculatePrice(int $length): float
    {
        if ($this->priceUnit === 'meter') {
            // Vente au mètre : simple multiplication
            return $length * $this->price;
        }

        // Vente au rouleau : on compte combien de rouleaux complets
        $rollsNeeded = ceil($length / $this->maxLengthPerRoll);
        return $rollsNeeded * $this->price;
    }

}   