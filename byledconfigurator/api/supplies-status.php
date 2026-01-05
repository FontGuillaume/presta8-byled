<?php

// Headers de sécurité communs
require_once __DIR__ . '/common/security-headers.php';

// Charger PrestaShop pour accès aux classes et constantes
require_once __DIR__ . '/../../../config/config.inc.php';

require_once __DIR__ . '/../src/Services/ConfiguratorService.php';

// Fonction commune pour récupérer les données PrestaShop
require_once __DIR__ . '/common/prestashop-functions.php';

try {
    // Validation sécurisée des paramètres
    $stripId = filter_input(INPUT_GET, 'strip_id', FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 10000]
    ]);
    
    $length = filter_input(INPUT_GET, 'length', FILTER_VALIDATE_FLOAT, [
        'options' => ['min_range' => 0.1, 'max_range' => 100.0]
    ]);

    if ($stripId === false || $stripId === null || $length === false || $length === null) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Paramètres invalides',
            'details' => 'strip_id (1-10000) et length (0.1-100) requis'
        ]);
        exit;
    }

    $service = new ConfiguratorService();
    $supplies = $service->getAllPowerSuppliesWithStatus($stripId, $length);

    // Transformer en format JSON avec enrichissement PrestaShop
    $result = [];
    foreach ($supplies as $item) {
        // Chercher le produit dans PrestaShop par référence
        $psData = getPrestashopProductData($item['supply']->reference);
        
        // Utiliser les données PS si trouvées, sinon fallback sur JSON
        $price = $psData ? (float)$psData['price'] : $item['supply']->price;
        $stock = $psData ? (int)$psData['quantity'] : null;
        
        // Pour l'image : si pas d'image PS OU si l'image n'a pas d'ID, utiliser celle du JSON
        $imageUrl = $item['supply']->imageUrl ?? null;
        if ($psData && !empty($psData['id_image'])) {
            $imageUrl = $psData['image_url'];
        }
        
        $result[] = [
            'id' => $item['supply']->id,
            'name' => $item['supply']->name,
            'reference' => $item['supply']->reference,
            'image_url' => $imageUrl,
            'type' => $item['supply']->type ?? null,
            'voltage' => $item['supply']->voltage,
            'max_power' => $item['supply']->maxPower,
            'price' => $price,
            'stock' => $stock,
            'in_stock' => $stock !== null && $stock > 0,
            'ps_linked' => $psData !== null,
            'wiring' => $item['supply']->wiring ?? 'pre-cable',
            'info' => $item['supply']->info ?? null,
            'compatible' => $item['compatible'],
            'recommended' => $item['recommended'],
            'reason' => $item['reason'],
            'id_product' => $psData ? (int)$psData['id_product'] : null,
            'link_rewrite' => $psData ? $psData['link_rewrite'] : null
        ];
    }

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur lors de la récupération des alimentations',
        'code' => 'SUPPLIES_FETCH_ERROR'
    ]);
    error_log('supplies-status.php error: ' . $e->getMessage());
}
