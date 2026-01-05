<?php

/**
 * Classe représentant un contrôleur LED
 * Correspond aux données de data/controllers.json
 */
class Controller
{
    //=== IDENTIFIANTS ===
    public $id;                      // ID unique du contrôleur
    public $name;                 // Nom commercial (ex: "Contrôleur RGB 12V")
    public $reference;            // Référence produit (ex: "CTRL-RGB-12V")
    public $imageUrl;            // URL de l'image du produit (optionnel)

    //=== CARACTERISTIQUES TECHNIQUES ===
    public $type;                 // Type compatible : UNIVERSAL, MONO/RGBW, MONO/RGB, etc.
    public  $usage;          // Usage(s) du contrôleur : "Classic", ["Classic", "Musical"], etc.
    public $controlModes;          // Modes de pilotage supportés : remote, button, motion, wifi
    public $voltageMin;              // Tension minimum supportée (5V)
    public $voltageMax;              // Tension maximum supportée (24V)
    public $maxPower;                // Puissance maximum supportée en Watts
    public  $supportedChips;        // Liste des puces LED supportées (WS2811, WS2815B, etc.)
    public  $maxPixels;              // Nombre maximum de pixels contrôlables (null si non applicable)
    public  $wiring;              // Type de câblage : "pre-cable" ou "cablage-requis"
    public  $info;                // Information complémentaire pour tooltip

    //=== PRIX ===
    public $price;                 // Prix du contrôleur

    /**
     * Constructeur : transforme les données JSON en objet Controller
     * @param array $data Tableau associatif venant du JSON
     */
    public function __construct(array $data)
    {
        $this->id = $data['id'];
        $this->name = $data['name'];
        $this->reference = $data['reference'];
        $this->imageUrl = $data['image_url'] ?? null;
        $this->type = $data['type'];
        $this->usage = $data['usage'] ?? 'Classic';
        $this->controlModes = $data['control_modes'] ?? [];
        $this->voltageMin = $data['voltage_min'];
        $this->voltageMax = $data['voltage_max'];
        $this->maxPower = $data['max_power'];
        $this->supportedChips = $data['supported_chips'];
        $this->maxPixels = $data['max_pixels'];
        $this->wiring = $data['wiring'] ?? 'pre-cable';
        $this->info = $data['info'] ?? null;
        $this->price = $data['price'];
    }

    /**
     * Modèle SPIR3M (référence COM-DIG-RGBW-SPIR3-M)
     */
    public function isSpir3m(): bool
    {
        return stripos($this->reference, 'SPIR3-M') !== false;
    }

    /**
     * Vérifie si ce contrôleur est compatible avec un ruban LED
     * @param string $stripType Type du ruban (RGB, RGBW, MONO, etc.)
     * @param int $voltage Voltage du ruban (12V ou 24V)
     * @param string $chipType Type de puce du ruban (WS2811, WS2815B, IC1935, etc.)
     * @param int $totalPixels Nombre total de pixels à contrôler
     * @return bool true si compatible
     */
    public function isCompatibleWith(string $ledstripType, int $voltage, string $chipType, int $totalPixels): bool
    {
        // SPIR3M : usage restreint aux rubans 24V uniquement
        if ($this->isSpir3m() && $voltage !== 24) {
            return false;
        }

        // 1. Vérifier le voltage
        if ($voltage < $this->voltageMin || $voltage > $this->voltageMax) {
            return false;
        }

        // 2. Vérifier le type de LED (MONO, RGB etc..)
        if (!$this->supportsType($ledstripType)) {
            return false;
        }

        // 3. Vérifier que le chip est supporté (avec gestion WS2815/WS2815B)
        if (!$this->supportsChip($chipType)) {
            return false;
        }

        // 4. Vérifier la capacité en pixels
        if ($totalPixels > $this->maxPixels) {
            return false;
        }

        return true;
    }

    /**
     * Vérifie si le contrôleur supporte un type de ruban
     * @param string $ledstripType Type du ruban (MONO, RGB, RGBW, etc.)
     * @return bool true si supporté
     */
    private function supportsType(string $ledstripType): bool
    {
        // Type universel accept tout
        if ($this->type === 'UNIVERSAL') {
            return true;
        }

        // Type composite (ex: "MONO/RGB, "MONO/RGBW")
        $supportedTypes = explode('/', $this->type);
        return in_array($ledstripType, $supportedTypes);
    }

    /**
     * Vérifie si le contrôleur supporte un type de puce
     * Gère les variantes comme WS2815/WS2815B qui sont compatibles entre elles
     * @param string $chipType Type de puce du ruban
     * @return bool true si supporté
     */
    private function supportsChip(string $chipType): bool
    {
        // Vérification directe
        if (in_array($chipType, $this->supportedChips)) {
            return true;
        }

        // Gestion des variantes WS2815 / WS2815B (compatibles entre elles)
        if ($chipType === 'WS2815B' && in_array('WS2815', $this->supportedChips)) {
            return true;
        }
        if ($chipType === 'WS2815' && in_array('WS2815B', $this->supportedChips)) {
            return true;
        }

        return false;
    }
   

    /**
     * Vérifie si ce contrôleur peut gérer une puissance donnée
     * @param float $power Puissance à gérer en Watts
     * @return bool true si le contrôleur peut supporter cette puissance
     */
    public function canHandle(float $power): bool
    {
        return $this->maxPower >= $power;
    }


    /**
    * Calcule le nombre de cannaux nécessaires pour une configuration donnée
    */
    public function getChannelsNeeded(int $totalPixels): int
    {
        return (int)ceil($totalPixels / $this->maxPixels); 
    }

    /**
     * Vérifie si le contrôleur peut gérer le nombre total de pixels
     */
    public function canHandlePixels(int $totalPixels): bool
    {
        // Simplifié : vérifier seulement si le total dépasse maxPixels
        return $totalPixels <= $this->maxPixels;
    }

    /**
     * Calcule les sections recommandées pour l'installation
     */

    public function calculateSections(int $length, int $ledsPerMeter): array
    {
        $totalPixels = (int)($length * $ledsPerMeter);
        $channelsNeeded = $this->getChannelsNeeded($totalPixels);

        // Longueur max par section (arrondi à l'entier)
        $maxLengthPerSection = (int)floor($this->maxPixels / $ledsPerMeter);

        $sections = [];
        $remainingLength = (int)$length;

        for ($i = 1; $i <= $channelsNeeded; $i++) {
            if ($i < $channelsNeeded) {
                $sectionLength = min($maxLengthPerSection, $remainingLength);
            } else {
                $sectionLength = $remainingLength;
            }

            $sections[] = [
                'zone' => $i,
                'length' => $sectionLength,
                'pixels' => $sectionLength * $ledsPerMeter
            ];

            $remainingLength -= $sectionLength;
        }

        return $sections;
    }
}