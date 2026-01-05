<?php

// Importer tous les Repositories nécessaires
require_once __DIR__ . '/../Repositories/LedStripRepository.php';
require_once __DIR__ . '/../Repositories/PowerSupplyRepository.php';
require_once __DIR__ . '/../Repositories/RemoteRepository.php';
require_once __DIR__ . '/../Repositories/ControllerRepository.php';
require_once __DIR__ . '/../Repositories/CableRepository.php';

/**
 * Service principal du configurateur LED
 * Contient toute la logique métier pour recommander les produits
 */
class ConfiguratorService
{
    /**
     * Repositories pour accéder aux données
     * (pas de typage de propriété pour compat PHP 7.1)
     */
    private $ledStripRepo;
    private $powerSupplyRepo;
    private $remoteRepo;
    private $controllerRepo;
    private $cableRepo;

    /**
     * Configuration de l'application
     */
    private $config;

    /**
     * Constructeur : initialise tous les repositories et la config
     */
    public function __construct()
    {
        // 1. Charger la configuration
        $this->config = require __DIR__ . '/../../config/app.php';

        // 2. Initialiser tous les repositories
        $this->ledStripRepo = new LedStripRepository();
        $this->powerSupplyRepo = new PowerSupplyRepository();
        $this->remoteRepo = new RemoteRepository();
        $this->controllerRepo = new ControllerRepository();
        $this->cableRepo = new CableRepository();
    }

    /**
     * Calcule la puissance totale nécessaire pour une installation
     * @param int $ledStripId ID du ruban LED choisi
     * @param int $length Longueur en mètres
     * @return float Puissance totale en Watts (avec marge de sécurité)
     */
    public function calculateTotalPower(int $ledStripId, int $length): float
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        $rawPower = $ledStrip->calculateTotalPower($length);

        // Marge de sécurité (ex: 0.2)
        $margin = isset($this->config['power_supply_margin']) ? (float)$this->config['power_supply_margin'] : 0.2;

        return $rawPower * (1 + $margin);
    }

    /**
     * Recommande l'alimentation la plus adaptée
     * @param int $ledStripId
     * @param int $length
     * @return PowerSupply|null
     */
    public function recommendPowerSupply(int $ledStripId, int $length): ?PowerSupply
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        $requiredPower = $this->calculateTotalPower($ledStripId, $length);

        // Toutes les alimentations du même voltage
        $compatibleSupplies = $this->powerSupplyRepo->findByVoltage($ledStrip->voltage);

        // Si 24V : prioriser les Meanwell (type === 'meanwell') les plus proches au-dessus du besoin
        if ($ledStrip->voltage === 24) {
            $meanwell = array_filter($compatibleSupplies, function ($s) use ($requiredPower) {
                return (strtolower((string)$s->type) === 'meanwell') && $s->canHandle($requiredPower);
            });
            if (!empty($meanwell)) {
                usort($meanwell, function ($a, $b) use ($requiredPower) {
                    return ($a->maxPower - $requiredPower) <=> ($b->maxPower - $requiredPower);
                });
                return $meanwell[0];
            }
        }

        // Choisir l'alim la plus proche au-dessus du besoin (fallback générique)
        $recommended = null;
        $minDifference = PHP_INT_MAX;

        foreach ($compatibleSupplies as $supply) {
            if ($supply->canHandle($requiredPower)) {
                $difference = $supply->maxPower - $requiredPower;
                if ($difference < $minDifference) {
                    $minDifference = $difference;
                    $recommended = $supply;
                }
            }
        }

        return $recommended;
    }

    /**
     * Recommande le meilleur contrôleur compatible (le moins cher compatible)
     * @param int $ledStripId
     * @param int $length
     * @return Controller|null
     */
    public function recommendController(int $ledStripId, int $length): ?Controller
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        $pixelsPerMeter = $ledStrip->pixelsPerMeter ?? $ledStrip->ledsPerMeter;
        $totalPixels = (int)($pixelsPerMeter * $length);

        $controllers = $this->controllerRepo->findAll();

        $compatibleControllers = [];
        foreach ($controllers as $controller) {
            if ($controller->isCompatibleWith(
                $ledStrip->type,
                $ledStrip->voltage,
                $ledStrip->chipType,
                $totalPixels
            )) {
                $compatibleControllers[] = $controller;
            }
        }

        if (empty($compatibleControllers)) {
            return null;
        }

        // En 24V, privilégier le SPIR3M (COM-DIG-RGBW-SPIR3-M)
        if ($ledStrip->voltage === 24) {
            $spir3m = array_filter($compatibleControllers, function ($c) {
                return $c->isSpir3m();
            });

            if (!empty($spir3m)) {
                // Si SPIR3M disponible en 24V, le recommander
                return $spir3m[0];
            }
        }

        // Fallback générique (prix croissant)
        usort($compatibleControllers, function ($a, $b) {
            return $a->price <=> $b->price;
        });

        return $compatibleControllers[0];
    }

    /**
     * Recommande la meilleure télécommande compatible
     * @param int $ledStripId
     * @param int $length
     * @return Remote|null
     */
    public function recommendRemote(int $ledStripId, int $length): ?Remote
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        if (!$ledStrip->requiresController) {
            return null;
        }

        $controller = $this->recommendController($ledStripId, $length);
        if (!$controller) {
            return null;
        }

        $rawPower = $ledStrip->calculateTotalPower($length);
        $allRemotes = $this->remoteRepo->findAll();

        foreach ($allRemotes as $remote) {
            if ($remote->isCompatibleWith($controller->type, $controller->voltageMin, $controller->voltageMax, $rawPower)) {
                return $remote;
            }
        }

        return null;
    }

    /**
     * Retourne TOUTES les alimentations avec leur statut
     * @return array
     */
    public function getAllPowerSuppliesWithStatus(int $ledStripId, int $length): array
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        $requiredPower = $this->calculateTotalPower($ledStripId, $length);

        $allSupplies = $this->powerSupplyRepo->findByVoltage($ledStrip->voltage);
        $recommended = $this->recommendPowerSupply($ledStripId, $length);

        $result = [];
        foreach ($allSupplies as $supply) {
            $compatible = $supply->canHandle($requiredPower);

            $result[] = [
                'supply' => $supply,
                'compatible' => $compatible,
                'recommended' => $recommended && $supply->id === $recommended->id,
                'reason' => $compatible ? null : "Puissance insuffisante (besoin {$requiredPower}W)"
            ];
        }

        // Trier : compatibles d'abord, puis par puissance croissante
        usort($result, function ($a, $b) {
            if ($a['compatible'] !== $b['compatible']) {
                return $b['compatible'] - $a['compatible'];
            }
            return $a['supply']->maxPower <=> $b['supply']->maxPower;
        });

        return $result;
    }

    /**
     * Retourne TOUS les contrôleurs sans filtrage
     * @return array
     */
    public function getAllControllers(): array
    {
        return $this->controllerRepo->findAll();
    }

    /**
     * Retourne TOUS les contrôleurs avec leur statut de compatibilité
     * @return array
     */
    public function getAllControllersWithStatus(int $ledStripId, int $length): array
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED non trouvé");
        }

        $controllers = $this->controllerRepo->findAll();
        $recommended = $this->recommendController($ledStripId, $length);

        $ppm = $ledStrip->pixelsPerMeter ?? $ledStrip->ledsPerMeter;
        $totalPixels = (int)($ppm * $length);

        $result = [];
        foreach ($controllers as $controller) {

            // Compatibilité technique (signature 4 params, cohérente avec recommendController())
            $compatible = $controller->isCompatibleWith(
                $ledStrip->type,
                $ledStrip->voltage,
                $ledStrip->chipType,
                $totalPixels
            );

            $reason = null;

            if (!$compatible) {
                if ($controller->isSpir3m() && $ledStrip->voltage !== 24) {
                    $reason = "SPIR3M utilisable uniquement en 24V";
                } elseif ($ledStrip->voltage < $controller->voltageMin || $ledStrip->voltage > $controller->voltageMax) {
                    $reason = "Voltage incompatible (besoin {$ledStrip->voltage}V, supporte {$controller->voltageMin}-{$controller->voltageMax}V)";
                } elseif (!in_array($ledStrip->type, explode('/', $controller->type)) && $controller->type !== 'UNIVERSAL') {
                    $reason = "Type incompatible (besoin {$ledStrip->type}, supporte {$controller->type})";
                } elseif (!in_array($ledStrip->chipType, $controller->supportedChips)) {
                    $reason = "Puce {$ledStrip->chipType} non supportée";
                } elseif ($totalPixels > $controller->maxPixels) {
                    $reason = "Trop de pixels ({$totalPixels} requis, max {$controller->maxPixels})";
                }
            }

            // Valeurs safe
            $channelsAvailable = !empty($controller->channels) ? (int)$controller->channels : 1;
            $isMultiZone = !empty($controller->is_multi_zone) || ($channelsAvailable > 1);

            $sections = null;
            $channelsNeeded = 1;

            if ($isMultiZone) {
                $sections = $controller->calculateSections($length, $ledStrip->ledsPerMeter);
                $channelsNeeded = is_array($sections) ? count($sections) : 0;
            }

            $result[] = [
                'controller' => $controller,
                'compatible' => $compatible,
                'recommended' => $recommended && $controller->id === $recommended->id,
                'reason' => $reason,
                'channels_needed' => $channelsNeeded,
                'channels_available' => $channelsAvailable,
                'is_multi_zone' => $isMultiZone,
                'sections' => $sections,
                // longueur max en zone unique basée sur le "ppm" (pixels/m si dispo)
                'max_length_single_zone' => (int)floor($controller->maxPixels / ($ppm ?: 1))
            ];
        }

        return $result;
    }

    /**
     * Retourne TOUTES les télécommandes avec leur statut de compatibilité
     * @param int $ledStripId
     * @param float $length
     * @param int|null $controllerId
     * @return array
     */
    public function getAllRemotesWithStatus(int $ledStripId, float $length, ?int $controllerId = null): array
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        if (!$ledStrip->requiresController) {
            return [];
        }

        // Contrôleur choisi ou recommandé
        if ($controllerId) {
            $controller = $this->controllerRepo->findById($controllerId);
        } else {
            $controller = $this->recommendController($ledStripId, (int)$length);
        }

        if (!$controller) {
            return [];
        }

        $rawPower = $ledStrip->calculateTotalPower((int)$length);

        $allRemotes = $this->remoteRepo->findAll();
        $recommended = $this->recommendRemote($ledStripId, (int)$length);

        $result = [];
        foreach ($allRemotes as $remote) {
            $compatible = $remote->isCompatibleWith($controller->type, $controller->voltageMin, $controller->voltageMax, $rawPower);

            $reason = null;
            if (!$compatible) {
                if ($remote->type === 'UNIVERSAL' && $remote->voltage === 0) {
                    $reason = null;
                } elseif ($remote->type !== 'UNIVERSAL' && $remote->type !== $controller->type) {
                    $reason = "Type incompatible (besoin {$controller->type})";
                } elseif ($remote->voltage !== 0 && ($remote->voltage < $controller->voltageMin || $remote->voltage > $controller->voltageMax)) {
                    $reason = "Voltage incompatible (plage contrôleur: {$controller->voltageMin}-{$controller->voltageMax}V)";
                } elseif ($remote->maxPower !== 999 && $remote->maxPower < $rawPower) {
                    $reason = "Puissance insuffisante (besoin {$rawPower}W)";
                }
            }

            $result[] = [
                'remote' => $remote,
                'compatible' => $compatible,
                'recommended' => $recommended && $remote->id === $recommended->id,
                'reason' => $reason
            ];
        }

        usort($result, function ($a, $b) {
            if ($a['compatible'] !== $b['compatible']) {
                return $b['compatible'] - $a['compatible'];
            }
            return $a['remote']->price <=> $b['remote']->price;
        });

        return $result;
    }

    /**
     * Retourne tous les câbles disponibles
     * @return array
     */
    public function getAllCables(): array
    {
        return $this->cableRepo->findAll();
    }

    /**
     * Génère une configuration complète pour une installation LED
     * @param int $ledStripId
     * @param float $length
     * @return array
     */
    public function generateConfiguration(int $ledStripId, float $length): array
    {
        $ledStrip = $this->ledStripRepo->findById($ledStripId);
        if (!$ledStrip) {
            throw new Exception("Ruban LED #$ledStripId introuvable");
        }

        $totalPower = $this->calculateTotalPower($ledStripId, (int)$length);

        $powerSupply = $this->recommendPowerSupply($ledStripId, (int)$length);
        if (!$powerSupply) {
            throw new Exception("Aucune alimentation compatible trouvée");
        }

        $controller = $ledStrip->requiresController
            ? $this->recommendController($ledStripId, (int)$length)
            : null;

        $remote = $controller
            ? $this->recommendRemote($ledStripId, (int)$length)
            : null;

        $totalPrice = $ledStrip->calculatePrice((int)$length) + $powerSupply->price;
        if ($controller) {
            $totalPrice += $controller->price;
        }
        if ($remote) {
            $totalPrice += $remote->price;
        }

        return [
            'led_strip' => [
                'product' => $ledStrip,
                'length' => $length,
                'price' => $ledStrip->calculatePrice((int)$length)
            ],
            'power_supply' => [
                'product' => $powerSupply,
                'price' => $powerSupply->price
            ],
            'controller' => $controller ? [
                'product' => $controller,
                'price' => $controller->price
            ] : null,
            'remote' => $remote ? [
                'product' => $remote,
                'price' => $remote->price
            ] : null,
            'total_power' => $totalPower,
            'total_price' => $totalPrice
        ];
    }

    /**
     * Retourne un ruban LED par son ID
     * @param int $id
     * @return LedStrip|null
     */
    public function getLedStripById(int $id): ?LedStrip
    {
        return $this->ledStripRepo->findById($id);
    }
}
