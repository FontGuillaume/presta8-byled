<?php

// Headers de sécurité communs
require_once __DIR__ . '/common/security-headers.php';

// Charger PrestaShop pour accès aux classes et constantes
require_once __DIR__ . '/../../../config/config.inc.php';

require_once __DIR__ . '/../src/Repositories/LedStripRepository.php';

// Fonction commune pour récupérer les données PrestaShop
require_once __DIR__ . '/common/prestashop-functions.php';

try {
    $repo = new LedStripRepository();
    $strips = $repo->findAll();

    // Transformer en format JSON simple avec enrichissement PrestaShop
    $result = [];
    foreach ($strips as $strip) {
        // Chercher le produit dans PrestaShop par référence
        $psData = getPrestashopProductData($strip->reference);
        
        // Utiliser les données PS si trouvées, sinon fallback sur JSON
        $price = $psData ? (float)$psData['price'] : $strip->price;
        $stock = $psData ? (int)$psData['quantity'] : null;
        $inStock = $psData && $psData['quantity'] > 0;
        $psLinked = $psData ? true : false;
        
        // Prioriser l'image PrestaShop, sinon celle du JSON
        $imageUrl = ($psData && isset($psData['image_url'])) 
            ? $psData['image_url'] 
            : ($strip->imageUrl ?? null);
        
        $result[] = [
            'id' => $strip->id,
            'name' => $strip->name,
            'image_url' => $imageUrl,             // Image PrestaShop ou JSON
            'reference' => $strip->reference,
            'type' => $strip->type,
            'signal_protocol' => $strip->signalProtocol,
            'wire_count' => $strip->wireCount,
            'voltage' => $strip->voltage,
            'power_per_meter' => $strip->powerPerMeter,
            'price' => $price,                    // Prix PrestaShop ou JSON
            'stock' => $stock,                    // Stock PrestaShop
            'in_stock' => $inStock,               // Disponibilité
            'ps_linked' => $psLinked,             // Indique si lié à PS
            'price_unit' => $strip->priceUnit,
            'requires_controller' => $strip->requiresController,
            'color_options' => $strip->colorOptions,
            'id_product' => $psData ? (int)$psData['id_product'] : null,
            'link_rewrite' => $psData ? $psData['link_rewrite'] : null
        ];
    }

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur lors de la récupération des rubans LED',
        'code' => 'STRIPS_FETCH_ERROR'
    ]);
    error_log('strips.php error: ' . $e->getMessage());
}