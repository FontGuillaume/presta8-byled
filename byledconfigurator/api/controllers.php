<?php

// Headers de sécurité communs
require_once __DIR__ . '/common/security-headers.php';

// Charger PrestaShop pour accès aux classes et constantes
require_once __DIR__ . '/../../../config/config.inc.php';

require_once __DIR__ . '/../src/Services/ConfiguratorService.php';

// Fonction commune pour récupérer les données PrestaShop
require_once __DIR__ . '/common/prestashop-functions.php';

try {
    $service = new ConfiguratorService();
    $controllers = $service->getAllControllers();
    
    // Whitelist des valeurs d'usage autorisées
    $allowedUsages = ['Classic', 'Dynamic', 'Stairs', 'Escalier', 'all'];
    
    // Récupérer et valider le paramètre usage
    $usageFilter = $_GET['usage'] ?? 'Classic';
    
    // Vérifier que l'usage est dans la whitelist
    if (!in_array($usageFilter, $allowedUsages, true)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Paramètre usage invalide',
            'details' => 'Valeurs autorisées : ' . implode(', ', $allowedUsages)
        ]);
        exit;
    }
    
    $result = [];
    
    // Si usage=all, retourner tous les contrôleurs
    if ($usageFilter === 'all') {
        foreach ($controllers as $controller) {
            // Chercher le produit dans PrestaShop par référence
            $psData = getPrestashopProductData($controller->reference);
            
            // Utiliser les données PS si trouvées, sinon fallback sur JSON
            $price = $psData ? (float)$psData['price'] : $controller->price;
            $stock = $psData ? (int)$psData['quantity'] : null;
            
            // Pour l'image : si pas d'image PS OU si l'image n'a pas d'ID, utiliser celle du JSON
            $imageUrl = $controller->imageUrl ?? null; // Défaut = image du JSON
            if ($psData && !empty($psData['id_image'])) {
                // Si PrestaShop a une image, l'utiliser
                $imageUrl = $psData['image_url'];
            }
            
            $result[] = [
                'id' => $controller->id,
                'name' => $controller->name,
                'reference' => $controller->reference,
                'image_url' => $imageUrl,
                'type' => $controller->type,
                'usage' => $controller->usage,
                'control_modes' => $controller->controlModes ?? [],
                'voltage_min' => $controller->voltageMin,
                'voltage_max' => $controller->voltageMax,
                'max_power' => $controller->maxPower,
                'max_pixels' => $controller->maxPixels,
                'supported_chips' => $controller->supportedChips,
                'price' => $price,
                'stock' => $stock,
                'in_stock' => $stock !== null && $stock > 0,
                'ps_linked' => $psData !== null,
                'id_product' => $psData ? (int)$psData['id_product'] : null,
                'link_rewrite' => $psData ? $psData['link_rewrite'] : null
            ];
        }
    } else {
        // Filtrer les contrôleurs selon l'usage demandé
        foreach ($controllers as $controller) {
            // Vérifier si l'usage demandé est dans usage (string ou array)
            $hasUsage = false;
            if (is_string($controller->usage)) {
                $hasUsage = ($controller->usage === $usageFilter);
            } elseif (is_array($controller->usage)) {
                $hasUsage = in_array($usageFilter, $controller->usage);
            }
            
            if ($hasUsage) {
                // Chercher le produit dans PrestaShop par référence
                $psData = getPrestashopProductData($controller->reference);
                
                // Utiliser les données PS si trouvées, sinon fallback sur JSON
                $price = $psData ? (float)$psData['price'] : $controller->price;
                $stock = $psData ? (int)$psData['quantity'] : null;
                
                // Pour l'image : si pas d'image PS OU si l'image n'a pas d'ID, utiliser celle du JSON
                $imageUrl = $controller->imageUrl ?? null; // Défaut = image du JSON
                if ($psData && !empty($psData['id_image'])) {
                    // Si PrestaShop a une image, l'utiliser
                    $imageUrl = $psData['image_url'];
                }
                
                $result[] = [
                    'id' => $controller->id,
                    'name' => $controller->name,
                    'reference' => $controller->reference,
                    'image_url' => $imageUrl,
                    'type' => $controller->type,
                    'usage' => $controller->usage,
                    'control_modes' => $controller->controlModes ?? [],
                    'voltage_min' => $controller->voltageMin,
                    'voltage_max' => $controller->voltageMax,
                    'max_power' => $controller->maxPower,
                    'max_pixels' => $controller->maxPixels,
                    'supported_chips' => $controller->supportedChips,
                    'price' => $price,
                    'stock' => $stock,
                    'in_stock' => $stock !== null && $stock > 0,
                    'ps_linked' => $psData !== null,
                    'id_product' => $psData ? (int)$psData['id_product'] : null,
                    'link_rewrite' => $psData ? $psData['link_rewrite'] : null
                ];
            }
        }
    }

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur lors de la récupération des contrôleurs',
        'code' => 'CONTROLLERS_FETCH_ERROR'
    ]);
    error_log('controllers.php error: ' . $e->getMessage());
}
