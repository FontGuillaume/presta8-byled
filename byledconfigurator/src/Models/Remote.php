<?php

/**
 * Classe représentant une télécommande LED
 * Correspond aux données de data/remotes.json
 */
class Remote
{
    //=== IDENTIFIANTS ===
    public $id;                    // ID unique de la télécommande
    public $name;               // Nom commercial (ex: "Télécommande IR RGB Basique")
    public $reference;          // Référence produit (ex: "REMOTE-RGB-IR-BASIC")
    public $imageUrl;          // URL de l'image du produit (optionnel)

    //=== CARACTERISTIQUES TECHNIQUES ===
    public $type;               // Type compatible : RGB, RGBW, RGBCCT, CCT, monochrome
    public $controlType;        // Type de contrôle : IR, RF, WiFi, Bluetooth
    public $voltage;               // Tension : 12V ou 24V
    public $maxPower;              // Puissance maximum supportée en Watts
    public $compatibleWithControllers; // Références des contrôleurs compatibles (optionnel)

    //=== PRIX ===
    public $price;               // Prix de la télécommande

    /**
     * Constructeur : transforme les données JSON en objet Remote
     * @param array $data Tableau associatif venant du JSON
     */
    public function __construct(array $data)
    {
        $this->id = $data['id'];
        $this->name = $data['name'];
        $this->reference = $data['reference'];
        $this->imageUrl = $data['image_url'] ?? null;
        $this->type = $data['type'];
        $this->controlType = $data['control_type'];
        $this->voltage = $data['voltage'];
        $this->maxPower = $data['max_power'];
        $this->price = $data['price'];
        $this->compatibleWithControllers = $data['compatible_with_controllers'] ?? null;
    }

    /**
     * Vérifie si cette télécommande est compatible avec un contrôleur
     * @param string $controllerType Type du contrôleur (RGB, RGBW, UNIVERSAL...)
     * @param int $controllerVoltageMin Voltage minimum du contrôleur
     * @param int $controllerVoltageMax Voltage maximum du contrôleur
     * @param float $totalPower Puissance totale de l'installation
     * @return bool true si compatible
     */
    public function isCompatibleWith(string $controllerType, int $controllerVoltageMin, int $controllerVoltageMax, float $totalPower): bool
    {
        // Si la télécommande est UNIVERSAL (type UNIVERSAL et voltage=0), elle est compatible avec tout
        if ($this->type === 'UNIVERSAL' && $this->voltage === 0) {
            // Vérifier seulement la puissance si max_power n'est pas 999 (illimité)
            if ($this->maxPower !== 999 && $this->maxPower < $totalPower) {
                return false;
            }
            return true;
        }

        // Sinon, vérifications classiques pour télécommandes spécifiques
        // Vérification type
        if ($this->type !== $controllerType && $this->type !== 'UNIVERSAL') {
            return false;
        }

        // Vérification voltage (doit être dans la plage du contrôleur)
        if ($this->voltage !== 0) { // 0 = universel
            if ($this->voltage < $controllerVoltageMin || $this->voltage > $controllerVoltageMax) {
                return false;
            }
        }

        // Vérification puissance (999 = illimité)
        if ($this->maxPower !== 999 && $this->maxPower < $totalPower) {
            return false;
        }

        return true;
    }
}